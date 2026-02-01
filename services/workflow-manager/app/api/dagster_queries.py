"""GraphQL queries for interacting with Dagster."""
import requests

DAGSTER_URL = "http://dagster-webserver:3000/dagster/graphql"


def list_dagster_jobs() -> list[dict]:
    """List all available Dagster jobs."""
    query = """
    query {
      repositoriesOrError {
        ... on RepositoryConnection {
          nodes {
            name
            location { name }
            jobs { name }
          }
        }
      }
    }
    """
    response = requests.post(DAGSTER_URL, json={"query": query}, timeout=3)
    response.raise_for_status()
    data = response.json()
    jobs = []
    for repo in data["data"]["repositoriesOrError"]["nodes"]:
        repo_name = repo["name"]
        location_name = repo["location"]["name"]
        for pipeline in repo["jobs"]:
            job_name = pipeline["name"]
            if job_name == "__ASSET_JOB":
              continue
            job_id = f"{location_name}::{repo_name}::{job_name}"
            jobs.append({
                "job_id": job_id,
                "job_name": job_name,
                "repository": repo_name,
                "location": location_name,
            })
    return jobs


def parse_job_id(job_id: str) -> tuple[str, str, str]:
    """Parse the job ID into its components."""
    parts = job_id.split("::")
    if len(parts) != 3:
        raise ValueError("Invalid job ID format")
    location, repository, job_name = parts
    return job_name, repository, location
