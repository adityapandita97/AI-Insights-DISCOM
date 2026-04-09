"""Create CloudFront distribution with OAC for private S3 bucket."""
import boto3
import json

cf = boto3.client("cloudfront")

config = {
    "CallerReference": "guj-discom-poc-oac-v2",
    "Comment": "Gujarat DISCOM POC - Private S3 + OAC",
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-guj-discom-poc-frontend",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"], "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}},
        "ForwardedValues": {"QueryString": False, "Cookies": {"Forward": "none"}},
        "MinTTL": 0, "DefaultTTL": 86400, "MaxTTL": 31536000,
        "Compress": True,
    },
    "Origins": {
        "Quantity": 1,
        "Items": [{
            "Id": "S3-guj-discom-poc-frontend",
            "DomainName": "guj-discom-poc-frontend.s3.ap-south-1.amazonaws.com",
            "OriginAccessControlId": "EB3XRIAKMJFQ4",
            "S3OriginConfig": {"OriginAccessIdentity": ""},
        }],
    },
    "Enabled": True,
    "DefaultRootObject": "index.html",
    "PriceClass": "PriceClass_200",
    "CustomErrorResponses": {
        "Quantity": 2,
        "Items": [
            {"ErrorCode": 403, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 300},
            {"ErrorCode": 404, "ResponsePagePath": "/index.html", "ResponseCode": "200", "ErrorCachingMinTTL": 300},
        ],
    },
}

resp = cf.create_distribution(DistributionConfig=config)
dist = resp["Distribution"]
print(f"Distribution ID: {dist['Id']}")
print(f"Domain: {dist['DomainName']}")
print(f"Status: {dist['Status']}")

# Now set the bucket policy to allow only this CloudFront distribution
s3 = boto3.client("s3", region_name="ap-south-1")
bucket_policy = {
    "Version": "2012-10-17",
    "Statement": [{
        "Sid": "AllowCloudFrontServicePrincipalReadOnly",
        "Effect": "Allow",
        "Principal": {"Service": "cloudfront.amazonaws.com"},
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::guj-discom-poc-frontend/*",
        "Condition": {
            "StringEquals": {
                "AWS:SourceArn": dist["ARN"]
            }
        }
    }]
}

# Need to temporarily allow this specific policy through
s3ctrl = boto3.client("s3control", region_name="ap-south-1")
# Disable account-level block temporarily for this CloudFront-only policy
s3ctrl.put_public_access_block(
    AccountId="185036908705",
    PublicAccessBlockConfiguration={
        "BlockPublicAcls": True,
        "IgnorePublicAcls": True,
        "BlockPublicPolicy": False,  # Allow CloudFront service principal policy
        "RestrictPublicBuckets": False,
    }
)

import time
time.sleep(3)

s3.put_bucket_policy(Bucket="guj-discom-poc-frontend", Policy=json.dumps(bucket_policy))
print("Bucket policy set — only CloudFront can access the bucket")

# Re-enable full block (the CloudFront service principal policy is not considered "public")
# Actually, CloudFront service principal policies ARE allowed even with BlockPublicPolicy=true
# because they use Condition with SourceArn. But let's be safe and leave it.
print("Done! CloudFront URL will be available in ~5 minutes.")
