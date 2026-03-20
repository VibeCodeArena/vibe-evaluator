import * as core from "@actions/core";
import * as exec from "@actions/exec";
import axios from "axios";
import fs from "fs";
import crypto from "crypto";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function zipRepo() {
  core.info("Zipping repository...");

  // Create zip (exclude .git)
  await exec.exec('zip -r repo.zip . -x "*.git*"');

  if (!fs.existsSync("repo.zip")) {
    throw new Error("Failed to create repo.zip");
  }

  core.info("Repo zipped successfully");

  // Compute checksum (SHA256)
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream("repo.zip");

  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => {
      const checksum = hash.digest("base64");
      resolve(checksum);
    });
    stream.on("error", reject);
  });
}

async function uploadToS3(presignedUrl, checksum) {
  core.info("Uploading to S3...");

  const stat = fs.statSync("repo.zip");
  const fileStream = fs.createReadStream("repo.zip");
  
  await axios.put(presignedUrl, fileStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": stat.size,
      "x-amz-checksum-sha256": checksum,
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  core.info("Upload complete");
}

async function pollStatus(backendUrl, payload) {
  const startTime = Date.now();
  const maxDuration = 20 * 60 * 1000; // 20 min
  let existingCompleted = -1;
  let completed = 0;

  core.info("Processing Evaluation ...");

  while (Date.now() - startTime < maxDuration) {
    await sleep(30000); // 30 sec

    const res = await axios.post(`${backendUrl}/notify-github-action-evaluation`, payload);

    completed = res.data.summary.completed ?? 0;

    if (completed !== existingCompleted) {
      core.info(`Progress: ${completed}%`);
      existingCompleted = completed;
    }

    if (completed >= 100) {
      return res.data;
    }
  }

  throw new Error("Timed out after 20 minutes");
}

async function main() {
  try {
    const backendUrl = "https://stageapi.vibecodearena.ai/api";

    const repoUrl = process.env.GITHUB_SERVER_URL + "/" + process.env.GITHUB_REPOSITORY;
    const commitId = process.env.GITHUB_SHA;

    core.info(`Repo: ${repoUrl}`);
    core.info(`Commit: ${commitId}`);

    // Ensure repo exists (checkout step required)
    if (!fs.existsSync(".git")) {
      throw new Error("Repository not checked out. Please add actions/checkout step.");
    }

    // Zip repo
    const checksum = await zipRepo();

    core.info(`Repo Checksum: ${checksum}`);

    // Obtain Presigned S3 Urls
    core.info("Initiate Github Action ...");

    const initiateEvaluation = await axios.post(`${backendUrl}/github-action-evaluation`, {
      url: repoUrl,
      commit_id: commitId,
      checksum: checksum
    });

    const {
      pre_signed_url,
      prompt_id,
      response_id,
      step,
    } = initiateEvaluation.data;

    const payload = {
      prompt_id,
      response_id,
      step,
    };

    // Upload Repo If Commit has not been evaluated previously
    if (pre_signed_url) {
      await uploadToS3(pre_signed_url, checksum);
    } else {
      core.info("This commit has already been evaluated. Skipping re-evaluation.");
    }

    // Poll Backend to Obtain Evaluation Summary
    const evaluationSummaryResponse = await pollStatus(backendUrl, payload);

    // Output summary
    const summary = evaluationSummaryResponse.summary || {};

    core.setOutput("summary", JSON.stringify(summary, null, 2));

    core.info("Completed successfully");
    core.info(`Summary: ${JSON.stringify(summary)}`);

  } catch (error) {
    core.setFailed(error.message);
  }
}

main();