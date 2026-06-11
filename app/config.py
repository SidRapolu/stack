"""Central configuration -- ONLINE-FIRST.

Defaults target the real stack: Bedrock embeddings + inference, pgvector store.
The fake providers still exist for offline tests, but you must explicitly opt
into them (EMBEDDING_PROVIDER=fake / STORE=memory). In any real run you set
DATABASE_URL + AWS creds and everything points at live services.

Required to run for real:
  - DATABASE_URL            Postgres with the pgvector extension
  - AWS credentials         standard boto3 chain (env / ~/.aws / role)
  - AWS_REGION              region where Bedrock models are enabled
"""
import os
from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise RuntimeError(
            f"{name} is not set. Online-first build: set it in your environment "
            f"or .env file. See README 'Connect' section."
        )
    return val


# --- Providers (online-first defaults) --------------------------------------
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "bedrock")  # bedrock | fake
STORE = os.getenv("STORE", "pgvector")                          # pgvector | memory
ANALYZER = os.getenv("ANALYZER", "bedrock")                     # bedrock | fake

# --- Database ---------------------------------------------------------------
# Python owns ONLY the doc_chunks table in this database. Go owns canvases.
# Lazy-required: only enforced when STORE=pgvector (see get_connection()).
DATABASE_URL = os.getenv("DATABASE_URL", "")

# --- AWS / Bedrock ----------------------------------------------------------
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

# Titan v2 = 1024-dim. This dimension is baked into the pgvector column type;
# changing the embedding model means a schema migration + full re-embed.
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1024"))

# Verify these IDs are current AND enabled in your region before running --
# Bedrock model strings change and availability is region-specific.
BEDROCK_EMBEDDING_MODEL = os.getenv("BEDROCK_EMBEDDING_MODEL", "amazon.titan-embed-text-v2:0")
BEDROCK_INFERENCE_MODEL = os.getenv("BEDROCK_INFERENCE_MODEL", "anthropic.claude-3-5-haiku-20241022-v1:0")

# --- Retrieval --------------------------------------------------------------
RETRIEVAL_TOP_K = int(os.getenv("RETRIEVAL_TOP_K", "5"))


def require_database_url() -> str:
    return _require("DATABASE_URL")
