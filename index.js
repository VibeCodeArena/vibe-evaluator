import * as core from "@actions/core";
import * as exec from "@actions/exec";
import fs from "fs";
import crypto from "crypto";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${res.statusText} ${text}`);
    }

    return res;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function zipRepo() {
  core.info("Zipping repository...");

  // Create zip (exclude .git)
    await exec.exec('zip', ['-rq', 'repo.zip', '.', '-x', '*.git*'], {
    silent: true,
  });

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

  const res = await fetchWithTimeout(
    presignedUrl,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": stat.size,
        "x-amz-checksum-sha256": checksum,
      },
      body: fileStream,
      duplex: "half",
    },
    5 * 60 * 1000 // 5 min for large uploads
  );

  core.info(`Upload complete (status: ${res.status})`);
}

async function pollStatus(backendUrl, payload) {
  const startTime = Date.now();
  const maxDuration = 20 * 60 * 1000; // 20 min
  let existingCompletionProgress = -1;

  while (Date.now() - startTime < maxDuration) {
    const res = await fetchWithTimeout(
      `${backendUrl}/notify-github-action-evaluation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Invalid JSON response from polling API");
    }

    const completionProgress = data.summary?.completion ?? 0;

    if (
      completionProgress !== existingCompletionProgress &&
      completionProgress !== 0
    ) {
      core.info(`Progress: ${completionProgress}%`);
      existingCompletionProgress = completionProgress;
    }

    if (completionProgress >= 100) {
      return data;
    }

    await sleep(30000); // 30 sec
  }

  throw new Error("Timed out after 20 minutes");
}

async function main() {
  try {
    const backendUrl = "https://stageapi.vibecodearena.ai/api";

    const repoUrl =
      process.env.GITHUB_SERVER_URL +
      "/" +
      process.env.GITHUB_REPOSITORY;
    const commitId = process.env.GITHUB_SHA;

    core.info(`Repo: ${repoUrl}`);
    core.info(`Commit: ${commitId}`);

    // Ensure repo exists (checkout step required)
    if (!fs.existsSync(".git")) {
      throw new Error(
        "Repository not checked out. Please add actions/checkout step."
      );
    }

    // Zip repo
    const checksum = await zipRepo();

    core.info(`Repo Checksum: ${checksum}`);

    core.info("Initiate Github Action ...");

    const initiateRes = await fetchWithTimeout(
      `${backendUrl}/github-action-evaluation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: repoUrl,
          commit_id: commitId,
          checksum: checksum,
        }),
      }
    );

    let initiateEvaluation;
    try {
      initiateEvaluation = await initiateRes.json();
    } catch {
      throw new Error("Invalid JSON response from initiate API");
    }

    const { pre_signed_url, prompt_id, response_id, step } =
      initiateEvaluation;

    core.info(`Prompt Id: ${prompt_id}`);
    core.info(`Response Id: ${response_id}`);
    core.notice(`The results can be accessed on our website once the evaluation is complete: https://stage.vibecodearena.ai/duel/${prompt_id}/${response_id}`);

    const payload = { prompt_id, response_id, step };

    if (pre_signed_url) {
      await uploadToS3(pre_signed_url, checksum);
      core.info("Processing Evaluation ...");
    } else {
      core.warning(
        "This commit has already been evaluated. Skipping re-evaluation."
      );
    }

    // Poll Backend to Obtain Evaluation Summar
    const evaluationSummaryResponse = await pollStatus(
      backendUrl,
      payload
    );

    const summary = evaluationSummaryResponse.summary || {};

    core.notice("Completed successfully");
    core.info(`Overall Score: ${summary.overall_score ?? 0.0}`);
    core.info(
      `Evaluation Summary: ${JSON.stringify(
        summary.evaluations ?? {},
        null,
        2
      )}`
    );
  } catch (error) {
    core.error(error.message);
  }
}

main();