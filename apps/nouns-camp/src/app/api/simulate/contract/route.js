import { fetchContractSimulation } from "../../tenderly-utils";

export async function POST(request) {
  const body = await request.json();
  return fetchContractSimulation(body);
}
