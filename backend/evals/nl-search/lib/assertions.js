function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function includesAnyText(text, terms) {
  const haystack = normalize(text);
  return asArray(terms).some((term) => haystack.includes(normalize(term)));
}

function getLeagueIds(parsed) {
  const leagues = Array.isArray(parsed) ? parsed : asArray(parsed?.leagues);
  return new Set(
    leagues
      .map((league) => {
        if (league == null) return null;
        if (typeof league === "string" || typeof league === "number") return String(league);
        return league.apiId != null ? String(league.apiId) : league.id != null ? String(league.id) : null;
      })
      .filter(Boolean)
  );
}

function getTeamNames(parsed) {
  const names = [];
  if (Array.isArray(parsed)) {
    parsed.forEach((team) => names.push(team?.name || team));
    return names.filter(Boolean);
  }
  asArray(parsed?.teams?.any).forEach((team) => names.push(team?.name || team));
  asArray(parsed?.primary?.teams).forEach((team) => names.push(team?.name || team));
  asArray(parsed?.teams).forEach((team) => names.push(team?.name || team));
  return names.filter(Boolean);
}

function compareValue(actual, expected, path, failures) {
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    const operatorKeys = Object.keys(expected).filter((k) => k.startsWith("$"));
    if (operatorKeys.length > 0) {
      applyOperators(actual, expected, path, failures);
      return;
    }

    Object.entries(expected).forEach(([key, value]) => {
      compareValue(actual?.[key], value, `${path}.${key}`, failures);
    });
    return;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      failures.push(`${path}: expected array`);
      return;
    }
    expected.forEach((value) => {
      if (!actual.includes(value)) {
        failures.push(`${path}: missing value ${JSON.stringify(value)}`);
      }
    });
    return;
  }

  if (actual !== expected) {
    failures.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function applyOperators(actual, operators, path, failures) {
  if (operators.$exists !== undefined) {
    const exists = actual !== null && actual !== undefined;
    if (exists !== operators.$exists) {
      failures.push(`${path}: expected $exists=${operators.$exists}, got ${exists}`);
    }
  }

  if (operators.$includesAll) {
    const arr = asArray(actual);
    const missing = operators.$includesAll.filter((v) => !arr.includes(v));
    if (missing.length > 0) {
      failures.push(`${path}: missing [${missing.join(", ")}]`);
    }
  }

  if (operators.$containsAny) {
    if (!includesAnyText(actual, operators.$containsAny)) {
      failures.push(`${path}: expected one of [${operators.$containsAny.join(", ")}]`);
    }
  }

  if (operators.$leagueIdsContain) {
    const ids = getLeagueIds(actual);
    const missing = operators.$leagueIdsContain.filter((id) => !ids.has(String(id)));
    if (missing.length > 0) {
      failures.push(`${path}: missing league ids [${missing.join(", ")}]`);
    }
  }

  if (operators.$teamNamesContain) {
    const names = getTeamNames(actual);
    const hasMatch = operators.$teamNamesContain.every((term) =>
      names.some((name) => normalize(name).includes(normalize(term)))
    );
    if (!hasMatch) {
      failures.push(`${path}: team names missing expected terms [${operators.$teamNamesContain.join(", ")}]`);
    }
  }

  if (operators.$oneOf) {
    if (!operators.$oneOf.includes(actual)) {
      failures.push(`${path}: expected one of [${operators.$oneOf.join(", ")}], got ${JSON.stringify(actual)}`);
    }
  }
}

function scoreExpectations(actual, expected = {}) {
  const failures = [];

  if (expected.httpStatus !== undefined && actual.httpStatus !== expected.httpStatus) {
    failures.push(`httpStatus: expected ${expected.httpStatus}, got ${actual.httpStatus}`);
  }

  if (expected.success !== undefined && actual.success !== expected.success) {
    failures.push(`success: expected ${expected.success}, got ${actual.success}`);
  }

  if (expected.isMultiQuery !== undefined && actual.isMultiQuery !== expected.isMultiQuery) {
    failures.push(`isMultiQuery: expected ${expected.isMultiQuery}, got ${actual.isMultiQuery}`);
  }

  if (expected.missingFields) {
    compareValue(actual.missingFields, expected.missingFields, "missingFields", failures);
  }

  if (expected.messageContainsAny) {
    if (!includesAnyText(actual.message, expected.messageContainsAny)) {
      failures.push(`message missing expected text: [${expected.messageContainsAny.join(", ")}]`);
    }
  }

  if (expected.messageNotContains) {
    const offending = expected.messageNotContains.find((term) =>
      includesAnyText(actual.message, [term])
    );
    if (offending) {
      failures.push(`message contains forbidden text: ${offending}`);
    }
  }

  if (expected.parsed) {
    compareValue(actual.parsed, expected.parsed, "parsed", failures);
  }

  return {
    passed: failures.length === 0,
    failures
  };
}

module.exports = {
  scoreExpectations
};
