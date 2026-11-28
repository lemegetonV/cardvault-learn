// A Playwright reporter the lab adds to each UI test run. It writes one JSON line per
// event to the pipe in LAB_TRACE_FD, the same way labtrace.py does for pytest:
//
//   {"type": "pw-test", ...}      a test starts (its project, file, line and title)
//   {"type": "pw-step", ...}      a step starts: an action, an expect() check, a test.step
//   {"type": "pw-step-end", ...}  that step ended, with its time and any error
//   {"type": "pw-outcome", ...}   how the test ended, with its screenshot, video and trace
//
// It changes nothing about how the tests run.
const fs = require('node:fs');
const path = require('node:path');

const SHOWN = new Set(['test.step', 'pw:api', 'expect', 'hook', 'fixture']);
const ANSI = /\u001b\[[0-9;]*m/g;
const plain = (text) => (text || '').replace(ANSI, '');

class LabReporter {
  constructor() {
    const fd = process.env.LAB_TRACE_FD;
    this.fd = fd ? Number(fd) : null;
    this.ids = new Map();
    this.next = 1;
    this.runDir = process.env.LAB_RUN_DIR || '';
    this.uiDir = process.env.UI_DIR || '';
  }

  emit(type, data) {
    if (this.fd === null) return;
    try {
      fs.writeSync(this.fd, `${JSON.stringify({ type, ...data })}\n`);
    } catch {
      this.fd = null; // the lab stopped listening; the tests carry on
    }
  }

  where(location) {
    if (!location) return null;
    return { file: path.relative(this.uiDir, location.file), line: location.line, code: this.codeAt(location) };
  }

  // The line of test code a step came from, so the page can show it beside the step.
  // A statement that runs over several lines is joined, up to five lines.
  codeAt(location) {
    try {
      if (!this.sources) this.sources = new Map();
      if (!this.sources.has(location.file)) this.sources.set(location.file, fs.readFileSync(location.file, 'utf8').split('\n'));
      const lines = this.sources.get(location.file);
      const parts = [];
      for (let i = location.line - 1; i < lines.length && parts.length < 5; i += 1) {
        parts.push(lines[i].trim());
        if (/[;{]\s*$/.test(lines[i]) || lines[i].trim() === '') break;
      }
      return parts.join(' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').slice(0, 300);
    } catch {
      return null;
    }
  }

  testKey(test) {
    return `${test.parent.project()?.name}:${test.id}`;
  }

  onTestBegin(test) {
    this.emit('pw-test', {
      id: this.testKey(test),
      project: test.parent.project()?.name,
      title: test.title,
      ...this.where(test.location),
    });
  }

  onStepBegin(test, result, step) {
    if (!SHOWN.has(step.category)) return;
    const id = this.next++;
    this.ids.set(step, id);
    let parent = step.parent;
    while (parent && !this.ids.has(parent)) parent = parent.parent;
    this.emit('pw-step', {
      test: this.testKey(test),
      id,
      parent: parent ? this.ids.get(parent) : null,
      category: step.category,
      title: plain(step.title),
      at: this.where(step.location),
    });
  }

  onStepEnd(test, result, step) {
    const id = this.ids.get(step);
    if (!id) return;
    this.emit('pw-step-end', {
      test: this.testKey(test),
      id,
      ms: Math.round(step.duration),
      error: step.error ? plain(step.error.message).slice(0, 4000) : null,
    });
  }

  onTestEnd(test, result) {
    const files = result.attachments
      .filter((a) => a.path && a.path.startsWith(this.runDir))
      .map((a) => ({ name: a.name, type: a.contentType, path: path.relative(this.runDir, a.path) }));
    const error = result.errors[0];
    this.emit('pw-outcome', {
      id: this.testKey(test),
      project: test.parent.project()?.name,
      title: test.title,
      status: result.status,
      expected: test.expectedStatus,
      seconds: Math.round(result.duration / 100) / 10,
      error: error ? plain(error.message || error.value).slice(0, 4000) : null,
      at: error && error.location ? this.where(error.location) : null,
      files,
    });
  }

  printsToStdio() {
    return false;
  }
}

module.exports = LabReporter;
