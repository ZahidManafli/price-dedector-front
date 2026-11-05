// Keeps track of background "List on eBay" jobs (backend services/listingJobs.js)
// after the modal that started them is closed. Job ids survive a page reload
// (localStorage); ListingJobToasts renders whatever is tracked here.
import { ebayAPI } from '../services/api';

const STORAGE_KEY = 'checkila.listingJobs.v1';
const POLL_MS = 4000;
const KEEP_FINISHED_MS = 2 * 60 * 1000;

let jobs = load();
const listeners = new Set();
let timer = null;

function load() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // storage blocked — tracking still works for this page view
  }
}

function emit() {
  save();
  listeners.forEach((fn) => fn(jobs));
  schedule();
}

function schedule() {
  const active = jobs.some((j) => j.status === 'pending' || j.status === 'processing');
  if (active && !timer) timer = setInterval(poll, POLL_MS);
  if (!active && timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function poll() {
  const active = jobs.filter((j) => j.status === 'pending' || j.status === 'processing');
  if (!active.length) return schedule();
  let changed = false;
  await Promise.all(
    active.map(async (job) => {
      try {
        const res = await ebayAPI.getListingJob(job.id);
        const next = res?.data?.job;
        if (next && next.status !== job.status) {
          Object.assign(job, next, { finishedSeenAt: null });
          changed = true;
        }
      } catch (err) {
        if (err?.response?.status === 404) {
          job.status = 'gone';
          changed = true;
        }
      }
    })
  );
  if (changed) emit();
}

export function trackListingJob(job) {
  jobs = [{ ...job }, ...jobs.filter((j) => j.id !== job.id)].slice(0, 10);
  emit();
}

// The modal shows its own progress while open; hide the toast meanwhile.
export function setListingJobHidden(jobId, hidden) {
  const job = jobs.find((j) => j.id === jobId);
  if (!job || Boolean(job.hiddenWhileModalOpen) === hidden) return;
  job.hiddenWhileModalOpen = hidden;
  emit();
}

export function dismissListingJob(jobId) {
  jobs = jobs.filter((j) => j.id !== jobId);
  emit();
}

export function getListingJobs() {
  return jobs;
}

export function subscribeListingJobs(fn) {
  listeners.add(fn);
  schedule();
  return () => listeners.delete(fn);
}

// Finished jobs linger a little, then drop off on the next update.
export function pruneFinishedJobs(now = Date.now()) {
  const before = jobs.length;
  jobs = jobs.filter((j) => (j.status === 'pending' || j.status === 'processing') || !j.finishedAt || now - new Date(j.finishedAt).getTime() < KEEP_FINISHED_MS);
  if (jobs.length !== before) emit();
}

if (typeof window !== 'undefined') schedule();
