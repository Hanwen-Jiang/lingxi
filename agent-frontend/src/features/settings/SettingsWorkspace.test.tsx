import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import type {ApiClient} from "../../api";
import {SettingsWorkspace} from "./SettingsWorkspace";

// Regression for D10: model-config + runtime-context are admin-only screens.
// Non-admins must see the connection chips, IngestionPanel, MemoryPanel, and a
// "仅管理员可修改" banner — but not the model-config form or the runtime ids.

function makeApi(): ApiClient {
  return {} as unknown as ApiClient;
}

function renderWorkspace(isAdmin: boolean) {
  return render(
    <SettingsWorkspace
      api={makeApi()}
      apiBase="/api"
      health="up"
      healthMessage="灵犀已连接"
      isAdmin={isAdmin}
      jobs={[]}
      memoryItems={[]}
      modelStatus={{
        provider: "openai-compatible",
        baseUrl: "https://api.openai.com",
        model: "gpt-5.4-mini",
        temperature: 0.7,
        maxOutputTokens: 1024,
        reasoningEffort: "medium",
        configured: true,
        message: "Configured",
      }}
      sessionId={"1"}
      userId={"1"}
      onBack={vi.fn()}
      onCheckHealth={vi.fn()}
      onJob={vi.fn()}
      onMemoryItems={vi.fn()}
      onModelStatus={vi.fn()}
      onNavigate={vi.fn()}
      onRefreshMemories={vi.fn()}
    />,
  );
}

describe("SettingsWorkspace · D10 admin gate", () => {
  it("non-admin sees the connection chips, ingestion and memory panels", () => {
    renderWorkspace(false);
    expect(screen.getByText("连接状态")).toBeInTheDocument();
    expect(screen.getByText("灵犀已连接")).toBeInTheDocument();
    // Ingestion and memory panels are user-owned and stay visible.
    expect(screen.getByText("知识入库")).toBeInTheDocument();
    expect(screen.getByText("记忆")).toBeInTheDocument();
  });

  it("non-admin sees the admin-only banner instead of the model-config form", () => {
    renderWorkspace(false);
    // Banner present.
    expect(screen.getByText("仅管理员可修改模型配置。如需调整,请联系管理员。")).toBeInTheDocument();
    // Form controls absent.
    expect(screen.queryByText("Base URL")).not.toBeInTheDocument();
    expect(screen.queryByText("温度")).not.toBeInTheDocument();
    expect(screen.queryByText("最大输出 tokens")).not.toBeInTheDocument();
    // Runtime-context (technical fields) hidden.
    expect(screen.queryByText("运行环境")).not.toBeInTheDocument();
    expect(screen.queryByText("API base")).not.toBeInTheDocument();
  });

  it("admin sees the full model-config form and runtime context", () => {
    renderWorkspace(true);
    // Runtime context restored.
    expect(screen.getByText("运行环境")).toBeInTheDocument();
    expect(screen.getByText("API base")).toBeInTheDocument();
    expect(screen.getByText("User ID")).toBeInTheDocument();
    expect(screen.getByText("Session ID")).toBeInTheDocument();
    // Model-config form fields rendered.
    expect(screen.getByText("Base URL")).toBeInTheDocument();
    expect(screen.getByText("温度")).toBeInTheDocument();
    expect(screen.getByText("最大输出 tokens")).toBeInTheDocument();
    // Banner gone.
    expect(screen.queryByText("仅管理员可修改模型配置。如需调整,请联系管理员。")).not.toBeInTheDocument();
  });

  it("admin's model-config form has no apiKey input (D10: never accept apiKey from client)", () => {
    renderWorkspace(true);
    // No element labelled "API key" — apiKey field was removed.
    expect(screen.queryByText("API key")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("粘贴 API key")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("留空保留当前 key")).not.toBeInTheDocument();
  });
});
