import {useCallback, useEffect, useState} from "react";

import type {ApiClient} from "../api";
import {isTerminalJob} from "../lib/chat";
import type {DocumentIngestJobResponse} from "../types";

// Document-ingestion jobs live at the app level (not inside SettingsWorkspace)
// so they survive chat<->settings navigation and so the chat composer's
// uploads feed the same job list the Ingestion panel polls and renders.
export function useIngestion({api}: {api: ApiClient}) {
  const [jobs, setJobs] = useState<DocumentIngestJobResponse[]>([]);

  useEffect(() => {
    const runningJobs = jobs.filter((job) => !isTerminalJob(job));
    if (!runningJobs.length) return;
    const timer = window.setInterval(() => {
      runningJobs.forEach((job) => {
        void api.getIngestJob(job.jobId).then((freshJob) => {
          setJobs((current) => current.map((item) => (item.jobId === freshJob.jobId ? freshJob : item)));
        });
      });
    }, 1800);
    return () => window.clearInterval(timer);
  }, [api, jobs]);

  const addJob = useCallback((job: DocumentIngestJobResponse) => {
    setJobs((current) => [job, ...current.filter((item) => item.jobId !== job.jobId)]);
  }, []);

  return {jobs, addJob};
}
