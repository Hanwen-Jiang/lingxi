import {useState} from "react";
import {CheckCircle2, FileInput, FileUp, RefreshCw, Upload, XCircle} from "lucide-react";

import {Button} from "@heroui/react/button";

import {PanelTitle, Field} from "../../components/ui/primitives";
import type {ApiClient} from "../../api";
import type {DocumentIngestJobResponse} from "../../types";

export function IngestionPanel({
  api,
  jobs,
  onJob,
}: {
  api: ApiClient;
  jobs: DocumentIngestJobResponse[];
  onJob: (job: DocumentIngestJobResponse) => void;
}) {
  const [textTitle, setTextTitle] = useState("");
  const [textFileName, setTextFileName] = useState("workspace-note.md");
  const [textContent, setTextContent] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function ingestText() {
    setStatus("正在提交…");
    try {
      const job = await api.ingestText({
        title: textTitle,
        fileName: textFileName,
        content: textContent,
        sourceType: "manual_text",
      });
      onJob(job);
      setStatus("已提交,正在入库");
      setTextContent("");
    } catch {
      setStatus("提交失败,请重试。");
    }
  }

  async function ingestUpload(file: File | undefined) {
    if (!file) return;
    setStatus("正在上传…");
    try {
      const job = await api.uploadDocument(file);
      onJob(job);
      setStatus("已上传,正在入库");
    } catch {
      setStatus("上传失败,请重试。");
    }
  }

  async function ingestLocalPath() {
    setStatus("正在提交…");
    try {
      const job = await api.ingestLocalPath(localPath);
      onJob(job);
      setStatus("已提交,正在入库");
    } catch {
      setStatus("提交失败,请重试。");
    }
  }

  return (
    <section className="space-y-5">
      <PanelTitle icon={<FileInput className="size-4" />} title="知识入库" />
      <div className="panel-section">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileInput className="size-4" />
          导入文本
        </div>
        <Field label="标题">
          <input className="field-input" value={textTitle} onChange={(event) => setTextTitle(event.target.value)} />
        </Field>
        <Field label="文件名">
          <input
            className="field-input"
            value={textFileName}
            onChange={(event) => setTextFileName(event.target.value)}
          />
        </Field>
        <Field label="正文">
          <textarea
            className="field-input min-h-28 resize-y"
            value={textContent}
            onChange={(event) => setTextContent(event.target.value)}
          />
        </Field>
        <Button className="settings-action-button" isDisabled={!textContent.trim()} onPress={() => void ingestText()}>
          提交文本
        </Button>
      </div>
      <div className="panel-section">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Upload className="size-4" />
          上传文件
        </div>
        <input
          className="field-input file:mr-3 file:rounded-xl file:border-0 file:bg-surface-secondary file:px-3 file:py-1.5 file:text-sm"
          type="file"
          onChange={(event) => void ingestUpload(event.target.files?.[0])}
        />
      </div>
      <div className="panel-section">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileUp className="size-4" />
          服务器路径
        </div>
        <Field label="路径">
          <input className="field-input" value={localPath} onChange={(event) => setLocalPath(event.target.value)} />
        </Field>
        <Button
          className="settings-action-button"
          isDisabled={!localPath.trim()}
          variant="outline"
          onPress={() => void ingestLocalPath()}
        >
          提交路径
        </Button>
      </div>
      {status ? <div className="rounded-2xl bg-surface p-3 text-sm text-muted shadow-surface">{status}</div> : null}
      <div className="space-y-3">
        <PanelTitle icon={<RefreshCw className="size-4" />} title="入库任务" />
        {jobs.length === 0 ? (
          <p className="rounded-2xl bg-surface p-3 text-sm text-muted shadow-surface">还没有入库任务。</p>
        ) : (
          jobs.map((job) => (
            <div key={job.jobId} className="rounded-2xl bg-surface p-3 shadow-surface">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium">{job.fileName ?? job.path ?? job.jobId}</span>
                <JobStatus status={job.status} />
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">{job.message ?? job.jobId}</p>
              {job.chunkCount !== undefined ? (
                <p className="mt-1 text-xs text-muted">已切片 {job.chunkCount} 段</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function jobStatusLabel(status: string) {
  switch (status) {
    case "SUCCEEDED":
      return "完成";
    case "FAILED":
      return "失败";
    case "PROCESSING":
      return "处理中";
    case "PENDING":
      return "等待中";
    default:
      return "进行中";
  }
}

function JobStatus({status}: {status: string}) {
  const success = status === "SUCCEEDED";
  const failed = status === "FAILED";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
        success ? "bg-success/15 text-success" : failed ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning"
      }`}
    >
      {success ? (
        <CheckCircle2 className="size-3" />
      ) : failed ? (
        <XCircle className="size-3" />
      ) : (
        <RefreshCw className="size-3" />
      )}
      {jobStatusLabel(status)}
    </span>
  );
}
