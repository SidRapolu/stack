"""Curated AWS doc sources -- THE FILE YOU MAINTAIN.

The fetcher reads SOURCES, pulls each page, section-chunks it, tags every chunk
with the entry's service/category, and writes corpus/aws_constraints.json.

To cover a new service: add a dict here and re-run the fetcher. Choose
CONSTRAINT-BEARING pages (quotas, limits, best-practices) -- not marketing
overviews. Corpus quality is the ceiling on retrieval quality.

category is one of: limit | best_practice | integration
"""

SOURCES = [
    # --- compute ---
    {"service": "lambda", "category": "limit",
     "url": "https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html"},
    {"service": "lambda", "category": "best_practice",
     "url": "https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html"},
    {"service": "lambda", "category": "integration",
     "url": "https://docs.aws.amazon.com/lambda/latest/dg/services-rds.html"},

    # --- datastores ---
    {"service": "dynamodb", "category": "limit",
     "url": "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ServiceQuotas.html"},
    {"service": "dynamodb", "category": "best_practice",
     "url": "https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html"},
    {"service": "rds", "category": "limit",
     "url": "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Limits.html"},

    # --- messaging / streaming ---
    {"service": "sqs", "category": "limit",
     "url": "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html"},
    {"service": "sqs", "category": "best_practice",
     "url": "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues.html"},
    {"service": "kinesis", "category": "limit",
     "url": "https://docs.aws.amazon.com/streams/latest/dev/service-sizes-and-limits.html"},

    # --- edge / gateway ---
    {"service": "apigateway", "category": "limit",
     "url": "https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html"},

    # --- storage / cache ---
    {"service": "s3", "category": "best_practice",
     "url": "https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html"},
    {"service": "elasticache", "category": "best_practice",
     "url": "https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/BestPractices.html"},
]
