import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as AeorefCom from '../lib/aeoref.com-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new AeorefCom.AeorefComStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
