import * as waf from 'aws-cdk-lib/aws-wafv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Aws, CfnOutput, Fn, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class CustomWebAclStack extends Stack {
  public readonly customWebAcl: waf.CfnWebACL;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const wafRules: waf.CfnWebACL.RuleProperty[] = [
      // 1, AWS Bot Control rule group
      {
        name: 'AWS-BotControl',
        priority: 1,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            name: 'AWSManagedRulesBotControlRuleSet',
            vendorName: 'AWS',
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `AWSManagedRulesBotControlRuleSetMetrics-${Aws.STACK_NAME}`,
          sampledRequestsEnabled: true,
        },
      },
      // 2, Amazon IP reputation list managed rule group
      {
        name: 'AWS-AmazonIpReputationList',
        priority: 2,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            name: 'AWSManagedRulesAmazonIpReputationList',
            vendorName: 'AWS',
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `AWSManagedRulesAmazonIpReputationListMetrics-${Aws.STACK_NAME}`,
          sampledRequestsEnabled: true,
        },
      },
      // 3, Anonymous IP list managed rule group
      {
        name: 'AWS-ManagedRulesAnonymousIpList',
        priority: 3,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            name: 'AWSManagedRulesAnonymousIpList',
            vendorName: 'AWS',
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `AWSManagedRulesAnonymousIpListMetrics-${Aws.STACK_NAME}`,
          sampledRequestsEnabled: true,
        },
      },
      // 4, AWS general rules (Core rule set)
      {
        name: 'AWS-ManagedRulesCommonRuleSet',
        priority: 4,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            name: 'AWSManagedRulesCommonRuleSet',
            vendorName: 'AWS',
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `AWSManagedRulesCommonRuleSetMetrics-${Aws.STACK_NAME}`,
          sampledRequestsEnabled: true,
        },
      },
      // 5, AWS Known Bad inputs rules
      {
        name: 'AWS-ManagedRulesKnownBadInputsRuleSet',
        priority: 5,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            name: 'AWSManagedRulesKnownBadInputsRuleSet',
            vendorName: 'AWS',
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `AWSManagedRulesKnownBadInputsRuleSetMetrics-${Aws.STACK_NAME}`,
          sampledRequestsEnabled: true,
        },
      },
      // 6, Admin protection managed rule group
      {
        name: 'AWS-AdminProtection',
        priority: 6,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            name: 'AWSManagedRulesAdminProtectionRuleSet',
            vendorName: 'AWS',
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `AWSManagedRulesAdminProtectionRuleSetMetrics-${Aws.STACK_NAME}`,
          sampledRequestsEnabled: true,
        },
      },
    ];

    // Define Web Application Firewall ACL
    const webAcl = new waf.CfnWebACL(this, 'rWebACL', {
      defaultAction: { allow: {} },
      scope: 'CLOUDFRONT',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: true,
        metricName: `WebAclMetrics-${Aws.STACK_NAME}`,
      },
      rules: wafRules,
    });

    // Web ACL log group
    const webAclLogGroup = new logs.LogGroup(this, 'rAmplifWebAclLogGroup', {
      retention: logs.RetentionDays.SIX_MONTHS,
      logGroupName: `aws-waf-logs-${Aws.STACK_NAME}`,
    });

    new waf.CfnLoggingConfiguration(this, 'rAmplifWebAclLoggingConfig', {
      logDestinationConfigs: [Fn.select(0, Fn.split(':*', webAclLogGroup.logGroupArn))],
      resourceArn: webAcl.attrArn,
    });

    this.customWebAcl = webAcl;

    new CfnOutput(this, 'oWebAclId', {
      value: webAcl.attrArn,
    });
  }
}
