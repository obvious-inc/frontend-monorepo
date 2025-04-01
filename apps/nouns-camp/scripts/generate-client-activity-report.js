#!/usr/bin/env node

/**
 * Nouns DAO Client Activity Report Generator
 *
 * Generates an ASCII-based report of voting and proposal statistics by client ID
 * for the specified time period.
 *
 * Features:
 * - Voting statistics by client ID
 * - Voting power distribution
 * - Unique voter breakdown
 * - Proposal creation breakdown by client ID 
 * - Detailed statistics and summaries
 *
 * Usage:
 *   node generate-client-activity-report.js --start TIMESTAMP --end TIMESTAMP [--output FILE]
 *
 * Options:
 *   --start      Start timestamp (Unix epoch)
 *   --end        End timestamp (Unix epoch)
 *   --output     Output file path (default: ../reports/client-activity-report.txt)
 *
 * Example:
 *   node generate-client-activity-report.js --start 1740833138 --end 1743421540
 *   node generate-client-activity-report.js --start 1740833138 --end 1743421540 --output ../reports/march-2025-activity.txt
 */

const fs = require("fs");
const { execSync } = require("child_process");

// Configuration
const DEFAULT_OUTPUT_FILE = "../reports/client-activity-report.txt";
const CHART_WIDTH = 20;

// Client names from src/client.js
const CLIENT_NAMES = {
  0: "Unknown (no client id)",
  1: "Noundry",
  2: "House of Nouns",
  3: "Camp",
  4: "nouns.biz",
  5: "NounSwap",
  6: "nouns.game",
  7: "Nouns Terminal",
  8: "Nouns GG",
  9: "Probe",
  10: "Nouns Agora",
  11: "Nouns 95",
  12: "Prop Launchpad",
  13: "Etherscan",
  14: "Pronouns",
  15: "nouns.auction",
  16: "Lighthouse",
  17: "Nouns Protocol",
  18: "anouns",
  19: "Etherscan",
};

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    startTimestamp: null,
    endTimestamp: null,
    outputFile: DEFAULT_OUTPUT_FILE,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start" && i + 1 < args.length) {
      params.startTimestamp = args[i + 1];
      i++;
    } else if (args[i] === "--end" && i + 1 < args.length) {
      params.endTimestamp = args[i + 1];
      i++;
    } else if (args[i] === "--output" && i + 1 < args.length) {
      params.outputFile = args[i + 1];
      i++;
    }
  }

  // Validate required parameters
  if (!params.startTimestamp || !params.endTimestamp) {
    console.error("Error: --start and --end timestamps are required");
    process.exit(1);
  }

  return params;
}

/**
 * Format timestamp to human-readable date
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date
 */
function formatTimestamp(timestamp) {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Generate an ASCII bar chart
 * @param {number} value - Current value
 * @param {number} max - Maximum value
 * @param {number} width - Chart width
 * @returns {string} ASCII bar chart
 */
function generateBarChart(value, max, width = CHART_WIDTH) {
  const barLength = Math.round((value / max) * width);
  return "[" + "#".repeat(barLength) + ".".repeat(width - barLength) + "]";
}

/**
 * Execute GraphQL query against the subgraph
 * @param {string} query - GraphQL query string or file path
 * @param {Object} variables - Query variables
 * @param {boolean} useFile - Whether to use a file for the query
 * @returns {string} Query result
 */
function executeQuery(query, variables = {}, useFile = false) {
  const flagParam = useFile ? "-f" : "-q";
  const varsParam = Object.keys(variables).length
    ? `-v '${JSON.stringify(variables)}'`
    : "";

  const cmd = `node ../tools/query-subgraph.js ${flagParam} ${query} ${varsParam}`;
  return execSync(cmd, { encoding: "utf8" }).trim();
}

/**
 * Process JSON data with jq
 * @param {string} data - Input JSON string
 * @param {string} filter - jq filter expression
 * @returns {any} Processed result
 */
function processWithJq(data, filter) {
  // Create a temporary file for the JSON data to avoid shell escaping issues
  const tempFile = `/tmp/nouns-camp-${Date.now()}.json`;
  fs.writeFileSync(tempFile, data);
  
  try {
    const result = execSync(`cat ${tempFile} | jq '${filter}'`, { encoding: "utf8" }).trim();
    return result;
  } finally {
    // Clean up the temporary file
    fs.unlinkSync(tempFile);
  }
}

/**
 * Fetch all required data from the subgraph
 * @param {string} startTimestamp - Start timestamp
 * @param {string} endTimestamp - End timestamp
 * @returns {Object} All voting data and proposal data
 */
function fetchVotingData(startTimestamp, endTimestamp) {
  console.log("Fetching voting data...");

  // Common query parameters
  const timeFilter = `blockTimestamp_gte: "${startTimestamp}", blockTimestamp_lt: "${endTimestamp}"`;
  
  // Get total votes (all votes including 0 voting power)
  const totalVotesQuery = `'{ votes(where: {${timeFilter}}, first: 1000) { id } }'`;
  const totalVotesResult = executeQuery(totalVotesQuery);
  const totalVotes = parseInt(processWithJq(totalVotesResult, '.votes | length'));

  // Get votes with voting power > 0
  const powerVotesQuery = `'{ votes(where: {${timeFilter}, votes_gt: "0"}, first: 1000) { id } }'`;
  const powerVotesResult = executeQuery(powerVotesQuery);
  const powerVotes = parseInt(processWithJq(powerVotesResult, '.votes | length'));

  // Get client vote data
  const votesQuery = "../tools/queries/votes-by-client-id.graphql";
  const variables = { startTimestamp, endTimestamp };
  const clientDataResult = executeQuery(votesQuery, variables, true);
  
  // Process client data with jq
  const clientDataJq = `.votes | group_by(.clientId) | map({
    clientId: .[0].clientId, 
    count: length, 
    voters: (map(.voter.id) | unique | length), 
    totalVotingPower: (map(.votes | tonumber) | add)
  })`;
  
  const clientData = JSON.parse(processWithJq(clientDataResult, clientDataJq));

  // Calculate total voting power
  const totalVotingPower = clientData.reduce(
    (sum, client) => sum + client.totalVotingPower, 0
  );

  // Get unique voters across all clients
  const votersByClientQuery = (clientId) => 
    `'{ votes(where: {${timeFilter}, votes_gt: "0", clientId: ${clientId}}, first: 1000) { voter { id } } }'`;
  
  // Collect all voter IDs
  let allVoterIds = [];
  for (const client of clientData) {
    const votersResult = executeQuery(votersByClientQuery(client.clientId));
    const voterIds = JSON.parse(processWithJq(votersResult, '.votes | map(.voter.id)'));
    allVoterIds = [...allVoterIds, ...voterIds];
  }

  // Count unique voters
  const totalUniqueVoters = new Set(allVoterIds).size;

  // Sort clients by activity (most active first)
  clientData.sort((a, b) => b.count - a.count);

  // Get proposal data
  console.log("Fetching proposal data...");

  // Get proposals using the file-based query
  const proposalsQuery = "../tools/queries/proposals-by-client-id.graphql";
  const proposalVars = { startTimestamp, endTimestamp };
  const proposalsResult = executeQuery(proposalsQuery, proposalVars, true);
  
  let proposals = JSON.parse(processWithJq(proposalsResult, '.proposals'));
  const totalProposals = proposals.length;
  
  // Group proposals by client ID
  const proposalDataJq = `.proposals | group_by(.clientId) | map({
    clientId: .[0].clientId, 
    count: length,
    proposers: (map(.proposer.id) | unique | length)
  })`;
  
  let proposalsByClient = JSON.parse(processWithJq(proposalsResult, proposalDataJq));
  
  // Sort proposals by count (most proposals first)
  proposalsByClient.sort((a, b) => b.count - a.count);

  return {
    totalVotes,
    powerVotes,
    clientData,
    totalVotingPower,
    totalUniqueVoters,
    proposalsByClient,
    totalProposals,
    hasClientIdForProposals: true
  };
}

/**
 * Generate the summary sections of the report
 * @param {Object} data - Voting data
 * @param {string} startTimestamp - Start timestamp
 * @param {string} endTimestamp - End timestamp
 * @returns {string} Report content
 */
function generateSummaryReport(data, startTimestamp, endTimestamp) {
  const { powerVotes, clientData, totalVotingPower, totalUniqueVoters } = data;

  // Generate formatted dates
  const startDate = formatTimestamp(parseInt(startTimestamp));
  const endDate = formatTimestamp(parseInt(endTimestamp));

  let report = `NOUNS DAO CLIENT ACTIVITY REPORT - ${startDate} to ${endDate}\n`;
  report += `========================================\n`;
  report += `Timestamps: ${startTimestamp} to ${endTimestamp} (Unix epoch)\n\n`;

  // VOTES BY CLIENT ID section
  report += `VOTES BY CLIENT ID (excluding 0 voting power)\n`;
  report += `--------------------------------------------\n`;
  const maxVotes = Math.max(...clientData.map((c) => c.count));

  // Calculate the maximum client name length first
  const clientNames = clientData.map(
    (c) => CLIENT_NAMES[c.clientId] || `Client ${c.clientId}`,
  );
  const maxClientNameLength = Math.max(
    ...clientNames.map((name) => name.length),
  );
  const namePadding = maxClientNameLength + 2; // Add 2 for extra spacing

  for (const client of clientData) {
    const percentage = ((client.count / powerVotes) * 100).toFixed(1);
    const bar = generateBarChart(client.count, maxVotes);
    const clientName =
      CLIENT_NAMES[client.clientId] || `Client ${client.clientId}`;
    report += `${clientName.padEnd(namePadding)} ${bar} ${client.count} votes (${percentage}%)\n`;
  }

  // TOTAL VOTING POWER section
  report += `\nTOTAL VOTING POWER BY CLIENT\n`;
  report += `--------------------------------------------\n`;
  const maxPower = Math.max(...clientData.map((c) => c.totalVotingPower));

  for (const client of clientData) {
    const percentage = (
      (client.totalVotingPower / totalVotingPower) *
      100
    ).toFixed(1);
    const bar = generateBarChart(client.totalVotingPower, maxPower);
    const clientName =
      CLIENT_NAMES[client.clientId] || `Client ${client.clientId}`;
    report += `${clientName.padEnd(namePadding)} ${bar} ${client.totalVotingPower} VP (${percentage}%)\n`;
  }

  // UNIQUE VOTERS section
  report += `\nUNIQUE VOTERS BY CLIENT ID\n`;
  report += `--------------------------------------------\n`;
  const maxVoters = Math.max(...clientData.map((c) => c.voters));

  for (const client of clientData) {
    const percentage = ((client.voters / totalUniqueVoters) * 100).toFixed(1);
    const bar = generateBarChart(client.voters, maxVoters);
    const clientName =
      CLIENT_NAMES[client.clientId] || `Client ${client.clientId}`;
    report += `${clientName.padEnd(namePadding)} ${bar} ${client.voters} voters (${percentage}%)\n`;
  }

  return report;
}

/**
 * Generate the detailed table section of the report
 * @param {Object} data - Voting data
 * @returns {string} Table content
 */
function generateDetailedTable(data) {
  const { powerVotes, clientData, totalVotingPower, totalUniqueVoters } = data;

  let report = `\nDETAILED BREAKDOWN\n`;
  report += `========================================\n`;

  // Calculate maximum widths for each column based on actual data
  const maxClientIdWidth = Math.max(
    "Client ID".length,
    ...clientData.map((c) => c.clientId.toString().length + 4), // Add padding
  );

  const maxDescriptionWidth = Math.max(
    "Description".length,
    ...clientData.map((c) => {
      const name = CLIENT_NAMES[c.clientId] || `Client ${c.clientId}`;
      return name.length;
    }),
  );

  const maxVoteCountWidth = Math.max(
    "Vote Count".length,
    ...clientData.map((c) => c.count.toString().length),
  );

  const maxPowerWidth = Math.max(
    "Voting Power".length,
    ...clientData.map((c) => c.totalVotingPower.toString().length),
  );

  const maxVotersWidth = Math.max(
    "Unique Voters".length,
    ...clientData.map((c) => c.voters.toString().length),
  );

  const percentWidth = 5; // 5 chars for percentage (4) + % sign

  // Create header row with proper column widths
  report += `${"Client ID".padEnd(maxClientIdWidth)} | `;
  report += `${"Description".padEnd(maxDescriptionWidth)} | `;
  report += `${"Vote Count".padEnd(maxVoteCountWidth)} | `;
  report += `${"%".padEnd(percentWidth)} | `;
  report += `${"Voting Power".padEnd(maxPowerWidth)} | `;
  report += `${"%".padEnd(percentWidth)} | `;
  report += `${"Unique Voters".padEnd(maxVotersWidth)} | `;
  report += `${"%".padEnd(percentWidth)}\n`;

  // Create separator line based on calculated widths
  const separatorLength =
    maxClientIdWidth +
    maxDescriptionWidth +
    maxVoteCountWidth +
    maxPowerWidth +
    maxVotersWidth +
    percentWidth * 3 +
    14; // 14 for separators (7 * " | ")

  const separator = "-".repeat(separatorLength);
  report += `${separator}\n`;

  // Format each row with consistent column widths
  for (const client of clientData) {
    const votePercentage = ((client.count / powerVotes) * 100).toFixed(1);
    const powerPercentage = (
      (client.totalVotingPower / totalVotingPower) *
      100
    ).toFixed(1);
    const voterPercentage = ((client.voters / totalUniqueVoters) * 100).toFixed(
      1,
    );
    const clientName =
      CLIENT_NAMES[client.clientId] || `Client ${client.clientId}`;

    report += `${" " + client.clientId.toString().padEnd(maxClientIdWidth - 1)} | `;
    report += `${clientName.padEnd(maxDescriptionWidth)} | `;
    report += `${client.count.toString().padEnd(maxVoteCountWidth)} | `;
    report += `${votePercentage.padStart(percentWidth - 1)}% | `;
    report += `${client.totalVotingPower.toString().padEnd(maxPowerWidth)} | `;
    report += `${powerPercentage.padStart(percentWidth - 1)}% | `;
    report += `${client.voters.toString().padEnd(maxVotersWidth)} | `;
    report += `${voterPercentage.padStart(percentWidth - 1)}%\n`;
  }

  // Add the totals row with proper alignment
  report += `${separator}\n`;
  report += `${" TOTAL".padEnd(maxClientIdWidth)} | `;
  report += `${" ".repeat(maxDescriptionWidth)} | `;
  report += `${powerVotes.toString().padEnd(maxVoteCountWidth)} | `;
  report += `${"100".padStart(percentWidth - 1)}% | `;
  report += `${totalVotingPower.toString().padEnd(maxPowerWidth)} | `;
  report += `${"100".padStart(percentWidth - 1)}% | `;
  report += `${totalUniqueVoters.toString().padEnd(maxVotersWidth)} | `;
  report += `${"100".padStart(percentWidth - 1)}%\n`;
  report += `${separator}\n`;

  return report;
}

/**
 * Generate proposals breakdown section
 * @param {Object} data - Data containing proposal information
 * @returns {string} Proposal breakdown content
 */
function generateProposalsBreakdown(data) {
  const { proposalsByClient, totalProposals } = data;
  
  if (!proposalsByClient || proposalsByClient.length === 0) {
    return "";
  }

  let report = `\nPROPOSALS BY CLIENT ID\n`;
  report += `--------------------------------------------\n`;
  
  const maxProposals = Math.max(...proposalsByClient.map((c) => c.count));
  
  // Calculate the maximum client name length first
  const clientNames = proposalsByClient.map(
    (c) => CLIENT_NAMES[c.clientId] || `Client ${c.clientId}`
  );
  const maxClientNameLength = Math.max(
    ...clientNames.map((name) => name.length)
  );
  const namePadding = maxClientNameLength + 2; // Add 2 for extra spacing
  
  for (const client of proposalsByClient) {
    const percentage = ((client.count / totalProposals) * 100).toFixed(1);
    const bar = generateBarChart(client.count, maxProposals);
    const clientName = CLIENT_NAMES[client.clientId] || `Client ${client.clientId}`;
    report += `${clientName.padEnd(namePadding)} ${bar} ${client.count} proposals (${percentage}%)\n`;
  }
  
  // Add detailed breakdown table for proposals
  report += `\nDETAILED PROPOSALS BREAKDOWN\n`;
  report += `========================================\n`;
  
  // Calculate maximum widths for each column
  const maxClientIdWidth = Math.max(
    "Client ID".length,
    ...proposalsByClient.map((c) => c.clientId.toString().length + 4)
  );
  
  const maxDescriptionWidth = Math.max(
    "Description".length,
    ...proposalsByClient.map((c) => {
      const name = CLIENT_NAMES[c.clientId] || `Client ${c.clientId}`;
      return name.length;
    })
  );
  
  const maxProposalCountWidth = Math.max(
    "Proposals".length,
    ...proposalsByClient.map((c) => c.count.toString().length)
  );
  
  const maxProposersWidth = Math.max(
    "Unique Proposers".length,
    ...proposalsByClient.map((c) => c.proposers.toString().length)
  );
  
  const percentWidth = 5; // 5 chars for percentage
  
  // Create header row
  report += `${"Client ID".padEnd(maxClientIdWidth)} | `;
  report += `${"Description".padEnd(maxDescriptionWidth)} | `;
  report += `${"Proposals".padEnd(maxProposalCountWidth)} | `;
  report += `${"%".padEnd(percentWidth)} | `;
  report += `${"Unique Proposers".padEnd(maxProposersWidth)}\n`;
  
  // Create separator line
  const separatorLength =
    maxClientIdWidth +
    maxDescriptionWidth +
    maxProposalCountWidth +
    percentWidth +
    maxProposersWidth +
    10; // 10 for separators (5 * " | ")
  
  const separator = "-".repeat(separatorLength);
  report += `${separator}\n`;
  
  // Format each row
  for (const client of proposalsByClient) {
    const percentage = ((client.count / totalProposals) * 100).toFixed(1);
    const clientName = CLIENT_NAMES[client.clientId] || `Client ${client.clientId}`;
    
    report += `${" " + client.clientId.toString().padEnd(maxClientIdWidth - 1)} | `;
    report += `${clientName.padEnd(maxDescriptionWidth)} | `;
    report += `${client.count.toString().padEnd(maxProposalCountWidth)} | `;
    report += `${percentage.padStart(percentWidth - 1)}% | `;
    report += `${client.proposers.toString().padEnd(maxProposersWidth)}\n`;
  }
  
  // Add totals row
  report += `${separator}\n`;
  report += `${" TOTAL".padEnd(maxClientIdWidth)} | `;
  report += `${" ".repeat(maxDescriptionWidth)} | `;
  report += `${totalProposals.toString().padEnd(maxProposalCountWidth)} | `;
  report += `${"100".padStart(percentWidth - 1)}% | `;
  
  // Calculate total unique proposers
  const totalUniqueProposers = proposalsByClient.reduce(
    (sum, client) => sum + client.proposers,
    0
  );
  
  report += `${totalUniqueProposers.toString().padEnd(maxProposersWidth)}\n`;
  report += `${separator}\n`;
  
  return report;
}

/**
 * Generate final summary section
 * @param {Object} data - Voting data
 * @returns {string} Summary content
 */
function generateFinalSummary(data) {
  const {
    totalVotes,
    powerVotes,
    clientData,
    totalVotingPower,
    totalUniqueVoters,
    proposalsByClient,
    totalProposals
  } = data;

  let report = `\nSUMMARY\n`;
  report += `========================================\n`;

  // Vote statistics
  const powerVotesPercent = ((powerVotes / totalVotes) * 100).toFixed(1);
  const zeroVotes = totalVotes - powerVotes;
  const zeroVotesPercent = ((zeroVotes / totalVotes) * 100).toFixed(1);

  report += `Total votes cast: ${totalVotes}\n`;
  report += `Votes with voting power > 0: ${powerVotes} (${powerVotesPercent}%)\n`;
  report += `Votes with 0 voting power: ${zeroVotes} (${zeroVotesPercent}%)\n\n`;
  report += `Total voting power: ${totalVotingPower}\n`;
  report += `Total unique voters: ${totalUniqueVoters}\n`;
  report += `Total proposals: ${totalProposals}\n\n`;

  // Most active and powerful clients
  const mostActiveClient = clientData[0];
  const mostPowerfulClient = [...clientData].sort(
    (a, b) => b.totalVotingPower - a.totalVotingPower,
  )[0];

  const activePercent = ((mostActiveClient.count / powerVotes) * 100).toFixed(
    1,
  );
  const powerPercent = (
    (mostPowerfulClient.totalVotingPower / totalVotingPower) *
    100
  ).toFixed(1);

  const activeName =
    CLIENT_NAMES[mostActiveClient.clientId] ||
    `Client ${mostActiveClient.clientId}`;
  const powerfulName =
    CLIENT_NAMES[mostPowerfulClient.clientId] ||
    `Client ${mostPowerfulClient.clientId}`;

  report += `Most active client: ${activeName} (${activePercent}% of votes)\n`;
  report += `Most influential client: ${powerfulName} (${powerPercent}% of voting power)\n`;
  
  // Most active proposer client
  if (proposalsByClient.length > 0) {
    const mostActiveProposerClient = proposalsByClient[0];
    const proposerPercent = ((mostActiveProposerClient.count / totalProposals) * 100).toFixed(1);
    const proposerName =
      CLIENT_NAMES[mostActiveProposerClient.clientId] ||
      `Client ${mostActiveProposerClient.clientId}`;
    
    report += `Most active proposal creator: ${proposerName} (${proposerPercent}% of proposals)\n`;
  }

  return report;
}

/**
 * Main function to generate the report
 */
async function generateReport() {
  try {
    // Parse command line arguments
    const { startTimestamp, endTimestamp, outputFile } = parseArgs();

    // Fetch voting data from the subgraph
    const data = fetchVotingData(startTimestamp, endTimestamp);

    // Generate each section of the report
    const summarySection = generateSummaryReport(data, startTimestamp, endTimestamp);
    const tableSection = generateDetailedTable(data);
    const proposalsSection = generateProposalsBreakdown(data);
    const finalSection = generateFinalSummary(data);

    // Combine all sections into the full report
    const fullReport = summarySection + tableSection + proposalsSection + finalSection;

    // Ensure the reports directory exists
    const reportDir = outputFile.substring(0, outputFile.lastIndexOf('/'));
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
      console.log(`Created directory: ${reportDir}`);
    }

    // Write the report to the output file
    fs.writeFileSync(outputFile, fullReport);
    console.log(`Report generated successfully: ${outputFile}`);
  } catch (error) {
    console.error("Error generating report:", error);
    process.exit(1);
  }
}

// Run the main function
generateReport();
