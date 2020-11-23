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

  }
}


