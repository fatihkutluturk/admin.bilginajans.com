import { NextRequest } from "next/server";
import { Content, Part } from "@google/genai";
import { chatWithGemini, chatWithToolResult } from "@/lib/gemini";
import { executeTool, classifyTool, isKnownTool, summarizeAction } from "@/lib/tools";
import { ChatRequest, StreamChunk, Message } from "@/lib/types";

function log(label: string, data?: unknown) {
  const ts = new Date().toISOString().slice(11, 23);
  if (data !== undefined) {
    const str = typeof data === "string" ? data : JSON.stringify(data, null, 0);
    console.log(`[CHAT ${ts}] ${label}: ${str.length > 500 ? str.slice(0, 500) + "..." : str}`);
  } else {
    console.log(`[CHAT ${ts}] ${label}`);
  }
}

function messagesToGeminiHistory(messages: Message[]): Content[] {
  return messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: StreamChunk) => {
        log("SEND", { type: chunk.type, contentLength: "content" in chunk ? chunk.content.length : 0, preview: "content" in chunk ? chunk.content.slice(0, 80) : "confirmation" });
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
      };

      try {
        const body: ChatRequest = await req.json();
        const { messages, pendingAction } = body;

        // --- Approval/Rejection flow ---
        if (pendingAction) {
          const { writes, approved } = pendingAction as { writes: Array<{ functionCall: { name: string; args: Record<string, unknown> }; summary: string }>; approved: boolean; combinedSummary: string };
          log("APPROVAL_FLOW", { approved, writeCount: writes?.length });

          if (approved && writes?.length) {
            const results: string[] = [];
            let hasError = false;

            for (const write of writes) {
              const { name, args } = write.functionCall;
              if (!isKnownTool(name)) {
                results.push(`Unknown tool: ${name}`);
                hasError = true;
                continue;
              }
              try {
                await executeTool(name, args);
                results.push(`${write.summary}: OK`);
              } catch (error) {
                results.push(`${write.summary}: FAILED — ${error instanceof Error ? error.message : "Error"}`);
                hasError = true;
              }
            }

            // Get Gemini's follow-up response
            const historyForResult: Content[] = [
              ...messagesToGeminiHistory(messages),
              {
                role: "model",
                parts: writes.map((w) => ({
                  functionCall: { name: w.functionCall.name, args: w.functionCall.args },
                })),
              },
              {
                role: "user",
                parts: writes.map((w) => ({
                  functionResponse: {
                    name: w.functionCall.name,
                    response: { result: results.join("; ") },
                  },
                })),
              },
            ];

            try {
              const response = await chatWithToolResult(historyForResult);
              const text =
                response.candidates?.[0]?.content?.parts?.[0]?.text ||
                (hasError ? results.join("\n") : "İşlemler başarıyla uygulandı.");
              send({ type: "result", content: text });
            } catch {
              send({ type: "result", content: hasError ? results.join("\n") : "İşlemler başarıyla uygulandı." });
            }
          } else {
            const history = messagesToGeminiHistory(messages);
            const response = await chatWithGemini(
              history,
              "Kullanıcı işlemi iptal etti. Devam etme."
            );
            const text =
              response.candidates?.[0]?.content?.parts?.[0]?.text ||
              "İşlem iptal edildi.";
            send({ type: "text", content: text });
          }

          controller.close();
          return;
        }

        // --- Normal chat flow ---
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== "user") {
          send({ type: "error", content: "No user message found" });
          controller.close();
          return;
        }

        const history: Content[] = messagesToGeminiHistory(messages.slice(0, -1));
        log("CHAT_START", { userMessage: lastMessage.content.slice(0, 100), historyLength: history.length });
        let response = await chatWithGemini(history, lastMessage.content);
        log("GEMINI_RESPONSE", { candidates: response.candidates?.length, finishReason: response.candidates?.[0]?.finishReason });

        let iterations = 0;
        const MAX_ITERATIONS = 8;
        const queuedWrites: Array<{ name: string; args: Record<string, unknown>; summary: string }> = [];

        while (iterations < MAX_ITERATIONS) {
          const candidate = response.candidates?.[0];
          const parts: Part[] = candidate?.content?.parts || [];

          const functionCallPart = parts.find((p) => p.functionCall);
          // Log all part keys to understand thought vs text structure
          for (let pi = 0; pi < parts.length; pi++) {
            const p = parts[pi] as Record<string, unknown>;
            if (p.thought) {
              log(`THOUGHT_${iterations}_${pi}`, String(p.text || "").slice(0, 500));
            }
          }
          const textParts = parts.filter((p) => {
            const pr = p as Record<string, unknown>;
            return p.text && !pr.thought;
          }).map((p) => p.text);
          log(`LOOP_ITER_${iterations}`, {
            hasFunctionCall: !!functionCallPart?.functionCall,
            functionName: functionCallPart?.functionCall?.name,
            textLength: textParts.join("").length,
            textPreview: textParts.join("").slice(0, 100),
            partsCount: parts.length,
            partTypes: parts.map((p) => p.functionCall ? `fn:${p.functionCall.name}` : p.text ? `text:${String(p.text).length}` : "other"),
            queuedWrites: queuedWrites.length,
          });

          if (!functionCallPart?.functionCall) {
            // Gemini done reasoning — send text + any queued writes
            // Filter out thought parts — only send actual response text
            const text = parts
              .filter((p) => p.text && !(p as Record<string, unknown>).thought)
              .map((p) => p.text)
              .filter(Boolean)
              .join("");

            if (queuedWrites.length > 0) {
              // Send AI's explanation text first
              if (text) {
                send({ type: "text", content: text });
              }
              // Then send batch confirmation
              send({
                type: "confirmation",
                pendingAction: {
                  writes: queuedWrites.map((w) => ({
                    functionCall: { name: w.name, args: w.args },
                    summary: w.summary,
                  })),
                  combinedSummary: queuedWrites.map((w) => w.summary).join("\n"),
                },
              });
            } else if (iterations > 0 && queuedWrites.length === 0) {
              // Model read data but didn't call a write tool — re-prompt to act
              log("RE_PROMPT", "Model read data but produced text instead of write tool. Re-prompting.");
              if (text) {
                send({ type: "text", content: text });
              }
              history.push(
                { role: "model", parts: [{ text: text || "Verileri okudum." }] },
                { role: "user", parts: [{ text: "Verileri okudun. Şimdi gerekli write aracını çağır. Metin yanıt verme, doğrudan araç çağır." }] }
              );
              response = await chatWithGemini(history, "Verileri okudun. Şimdi gerekli write aracını (clone_element veya update_elementor_styles) çağır. Açıklama yapma.");
              log("RE_PROMPT_RESPONSE", { candidates: response.candidates?.length, finishReason: response.candidates?.[0]?.finishReason });
              iterations++;
              continue;
            } else if (text) {
              send({ type: "text", content: text });
            }
            break;
          }

          const name = functionCallPart.functionCall.name!;
          const args = (functionCallPart.functionCall.args ?? {}) as Record<string, unknown>;

          if (!isKnownTool(name)) {
            send({ type: "error", content: `Unknown tool: ${name}` });
            break;
          }

          if (classifyTool(name) === "write") {
            // Queue the write — don't execute, don't break
            const summary = summarizeAction(name, args);
            log("QUEUE_WRITE", { name, summary });
            queuedWrites.push({ name, args, summary });

            // Send synthetic "queued" result back to Gemini so it can continue reasoning
            const updatedHistory: Content[] = [
              ...history,
              { role: "user", parts: [{ text: lastMessage.content }] },
              {
                role: "model",
                parts: [{ functionCall: { name, args } }],
              },
              {
                role: "user",
                parts: [
                  {
                    functionResponse: {
                      name,
                      response: {
                        result: {
                          status: "queued_for_approval",
                          action: summary,
                          message: "Bu işlem kullanıcı onayı bekliyor. Kullanıcıya ne yapılacağını açıkla.",
                        },
                      },
                    },
                  },
                ],
              },
            ];

            response = await chatWithToolResult(updatedHistory);
            history.push(
              { role: "user", parts: [{ text: lastMessage.content }] },
              { role: "model", parts: [{ functionCall: { name, args } }] },
              {
                role: "user",
                parts: [
                  {
                    functionResponse: {
                      name,
                      response: {
                        result: { status: "queued_for_approval", action: summary },
                      },
                    },
                  },
                ],
              }
            );
            iterations++;
            continue;
          }

          // Read operation → execute immediately
          try {
            log("EXEC_READ", { name, args: JSON.stringify(args).slice(0, 200) });
            const result = await executeTool(name, args);
            log("READ_RESULT", { name, resultType: typeof result, resultSize: JSON.stringify(result).length });

            const updatedHistory: Content[] = [
              ...history,
              { role: "user", parts: [{ text: lastMessage.content }] },
              {
                role: "model",
                parts: [{ functionCall: { name, args } }],
              },
              {
                role: "user",
                parts: [
                  {
                    functionResponse: {
                      name,
                      response: { result },
                    },
                  },
                ],
              },
            ];

            response = await chatWithToolResult(updatedHistory);
            log("TOOL_RESULT_RESPONSE", { candidates: response.candidates?.length, finishReason: response.candidates?.[0]?.finishReason });

            history.push(
              { role: "user", parts: [{ text: lastMessage.content }] },
              { role: "model", parts: [{ functionCall: { name, args } }] },
              {
                role: "user",
                parts: [
                  {
                    functionResponse: {
                      name,
                      response: { result },
                    },
                  },
                ],
              }
            );
            iterations++;
          } catch (error) {
            log("TOOL_ERROR", { name, error: error instanceof Error ? error.message : "Unknown" });
            send({
              type: "error",
              content: `Tool error: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
            break;
          }
        }

        if (iterations >= MAX_ITERATIONS) {
          if (queuedWrites.length > 0) {
            send({
              type: "confirmation",
              pendingAction: {
                writes: queuedWrites.map((w) => ({
                  functionCall: { name: w.name, args: w.args },
                  summary: w.summary,
                })),
                combinedSummary: queuedWrites.map((w) => w.summary).join("\n"),
              },
            });
          } else {
            send({
              type: "error",
              content: "Too many tool calls. Please try a simpler request.",
            });
          }
        }
      } catch (error) {
        log("SERVER_ERROR", { error: error instanceof Error ? error.stack || error.message : "Unknown" });
        send({
          type: "error",
          content: `Server error: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
