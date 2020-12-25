import * as cdk from '@aws-cdk/core';
import * as certificatemanager from '@aws-cdk/aws-certificatemanager'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as ecs from '@aws-cdk/aws-ecs'
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns'
import * as efs from '@aws-cdk/aws-efs'
import * as logs from '@aws-cdk/aws-logs'
import * as rds from '@aws-cdk/aws-rds'
import * as route53 from '@aws-cdk/aws-route53'

export class AeorefComStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domainZone = route53.HostedZone.fromLookup(this, 'DomainZone', {
      domainName: 'aeoref.com',
      privateZone: false,
    })
    const certificate = new certificatemanager.Certificate(this, 'Cert', {
      domainName: domainZone.zoneName,
      subjectAlternativeNames: [`*.${domainZone.zoneName}`],
      validation: certificatemanager.CertificateValidation.fromDns()
    })
    const logging = ecs.LogDriver.awsLogs({
      logGroup: new logs.LogGroup(this, 'CdkLogGroup', {
        logGroupName: 'aeoref.com',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        retention: logs.RetentionDays.ONE_WEEK
      }),
      streamPrefix: 'cdk'
    })

    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: 'aeoref-cdk',
      containerInsights: true,
      vpc: new ec2.Vpc(this, 'ClusterVpc', {
        cidr: '10.0.0.0/16',
        natGateways: 0,
        maxAzs: 2,
        subnetConfiguration: [
          {
            cidrMask: 18,
            name: 'Public',
            subnetType: ec2.SubnetType.PUBLIC,
          }
        ]
      })
    })
    const vpcSg = new ec2.SecurityGroup(this, 'VpcSecurityGroup', {
      vpc: cluster.vpc,
      allowAllOutbound: false,
      securityGroupName: 'core',
    })
    vpcSg.addIngressRule(ec2.Peer.ipv4(cluster.vpc.vpcCidrBlock), ec2.Port.allTraffic())
    vpcSg.addEgressRule(ec2.Peer.ipv4(cluster.vpc.vpcCidrBlock), ec2.Port.allTraffic())

    const aurora = new rds.ServerlessCluster(this, 'AuroraServerless', {
      engine: rds.DatabaseClusterEngine.AURORA_MYSQL,
      defaultDatabaseName: 'wordpress',
      scaling: {
        minCapacity: rds.AuroraCapacityUnit.ACU_1,
        maxCapacity: rds.AuroraCapacityUnit.ACU_2
      },
      vpc: cluster.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      securityGroups: [vpcSg],
    })
    const wpService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'WPService', {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('wordpress'),
        containerName: 'wordpress',
        environment: {
          WORDPRESS_DB_HOST: aurora.clusterEndpoint.hostname,
          WORDPRESS_DB_USER: 'admin',
          WORDPRESS_DB_PASSWORD: aurora.secret?.secretValueFromJson('password').toString() as string,
          WORDPRESS_DB_NAME: 'wordpress'
        },
        logDriver: logging,
      },
      certificate,
      assignPublicIp: true,
      domainName: `wp.${domainZone.zoneName}`,
      domainZone,
      platformVersion: ecs.FargatePlatformVersion.VERSION1_4,
      redirectHTTP: true,
    })
    wpService.targetGroup.configureHealthCheck({ path: '/index.php', healthyHttpCodes: '200,302' })

    const wpScaling = wpService.service.autoScaleTaskCount({ maxCapacity: 2, minCapacity: 1 })
    wpScaling.scaleOnMemoryUtilization('WpScaleByMemory', { targetUtilizationPercent: 75 })
    wpScaling.scaleOnCpuUtilization('WpScaleByCpu', { targetUtilizationPercent: 75 })

    const wpEfsVolume = new efs.FileSystem(this, 'WPVolume', {
      vpc: cluster.vpc,
      fileSystemName: 'wordpress-volume',
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      securityGroup: vpcSg,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    // WIP: waiting update for @aws-sdk/aws-ecs
    const wpRawTask = wpService.taskDefinition.node.defaultChild as ecs.CfnTaskDefinition
    wpRawTask.addPropertyOverride("Volumes", [{
      "EFSVolumeConfiguration": {
        "FilesystemId": wpEfsVolume.fileSystemId,
        "TransitEncryption": "ENABLED"
      },
      "Name": "efs"
    }])
    wpService.taskDefinition.defaultContainer?.addMountPoints({ containerPath: '/var/www/html', sourceVolume: 'efs', readOnly: false })
  }
}
