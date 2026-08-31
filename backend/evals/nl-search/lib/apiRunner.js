const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const mongoose = require("mongoose");
const request = require("supertest");
const { scoreExpectations } = require("./assertions");
const { ensureNlSearchEvalUser, getNlSearchAuthHeader } = require("../../../tests/helpers/nlSearchAuth");
let appInstance = null;

function getApp() {
  if (!appInstance) {
    appInstance = require("../../../src/app");
  }
  return appInstance;
}

async function ensureMongo() {
  if (mongoose.connection.readyState !== 0) return true;
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!uri) return false;

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    return true;
  } catch (_error) {
    return false;
  }
}

async function runApiCase(testCase) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      id: testCase.id,
      scenario: testCase.scenario,
      status: "skipped",
      mode: "api",
      failures: [],
      skipReason: "OPENAI_API_KEY not configured"
    };
  }

  const hasMongo = await ensureMongo();
  if (!hasMongo) {
    return {
      id: testCase.id,
      scenario: testCase.scenario,
      status: "skipped",
      mode: "api",
      failures: [],
      skipReason: "MongoDB not available"
    };
  }

  try {
    await ensureNlSearchEvalUser();
  } catch (error) {
    return {
      id: testCase.id,
      scenario: testCase.scenario,
      status: "skipped",
      mode: "api",
      failures: [],
      skipReason: `NL search eval user unavailable: ${error.message}`
    };
  }

  let authHeader;
  try {
    authHeader = getNlSearchAuthHeader();
  } catch (error) {
    return {
      id: testCase.id,
      scenario: testCase.scenario,
      status: "skipped",
      mode: "api",
      failures: [],
      skipReason: error.message
    };
  }

  const startedAt = Date.now();
  try {
    const response = await request(getApp())
      .post("/api/search/natural-language")
      .set("Authorization", authHeader)
      .send({
        query: testCase.input.query,
        source: testCase.input.source || "unknown",
        conversationHistory: testCase.input.conversationHistory || []
      });

    const body = response.body || {};
    const score = scoreExpectations(
      {
        ...body,
        httpStatus: response.status
      },
      testCase.expect
    );

    return {
      id: testCase.id,
      scenario: testCase.scenario,
      status: score.passed ? "passed" : "failed",
      mode: "api",
      failures: score.failures,
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      id: testCase.id,
      scenario: testCase.scenario,
      status: "failed",
      mode: "api",
      failures: [`api threw: ${error.message}`],
      durationMs: Date.now() - startedAt
    };
  }
}

async function cleanupApiRunner() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}

module.exports = {
  runApiCase,
  cleanupApiRunner
};
