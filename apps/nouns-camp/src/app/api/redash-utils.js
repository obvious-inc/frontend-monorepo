const REDASH_API_ENDPOINT = "https://data.hubs.neynar.com";

export const executeQuery = async (
  queryId,
  parameters = {},
  maxAge = 300,
  options = {},
) => {
  const {
    apiKey = process.env.REDASH_API_KEY,
    apiEndpoint = REDASH_API_ENDPOINT,
  } = options;

  const response = await fetch(
    `${apiEndpoint}/api/queries/${queryId}/results`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        parameters,
        max_age: maxAge,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(errorText);
    throw new Error(`Failed to execute Redash query: ${errorText}`);
  }

  const responseData = await response.json();

  if (responseData.job && !responseData.query_result) {
    return pollJobStatus(responseData.job.id, apiKey, apiEndpoint);
  }

  return responseData.query_result;
};

const pollJobStatus = async (jobId, apiKey, apiEndpoint) => {
  const maxAttempts = 10;
  const pollInterval = 500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${apiEndpoint}/api/jobs/${jobId}`, {
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(errorText);
      throw new Error(`Failed to poll job status: ${errorText}`);
    }

    const job = await response.json();

    if (job.job.status === 3) {
      return fetchQueryResults(job.job.query_result_id, apiKey, apiEndpoint);
    }

    if (job.job.status === 4) {
      throw new Error(`Query execution failed: ${job.job.error}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Query execution timed out after ${maxAttempts} attempts`);
};

const fetchQueryResults = async (queryResultId, apiKey, apiEndpoint) => {
  const response = await fetch(
    `${apiEndpoint}/api/query_results/${queryResultId}`,
    {
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(errorText);
    throw new Error(`Failed to fetch query results: ${errorText}`);
  }

  const data = await response.json();
  return data.query_result;
};
