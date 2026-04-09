import { NextRequest } from "next/server";
import { Content, Part } from "@google/genai";
import { chatWithGemini, chatWithToolResult } from "@/lib/gemini";
import { executeTool, classifyTool, isKnownTool, summarizeAction } from "@/lib/tools";
import { ChatRequest, StreamChunk, Message } from "@/lib/types";

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
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
      };

      try {
        const body: ChatRequest = await req.json();
        const { messages, pendingAction } = body;

        // --- Approval/Rejection flow ---
        if (pendingAction) {
          const { functionCall, approved } = pendingAction;

          if (approved) {
            if (!isKnownTool(functionCall.name)) {
              send({ type: "error", content: "Unknown tool" });
              controller.close();
              return;
            }

            try {
              const result = await executeTool(
                functionCall.name,
                functionCall.args
              );

              const history: Content[] = [
                ...messagesToGeminiHistory(messages),
                {
                  role: "model",
                  parts: [
                    {
                      functionCall: {
                        name: functionCall.name,
                        args: functionCall.args,
                      },
                    },
                  ],
                },
                {
                  role: "user",
                  parts: [
                    {
                      functionResponse: {
                        name: functionCall.name,
                        response: { result },
                      },
                    },
                  ],
                },
              ];

              const response = await chatWithToolResult(history);
              const text =
                response.candidates?.[0]?.content?.parts?.[0]?.text ||
                "Action completed successfully.";
              send({ type: "result", content: text });
            } catch (error) {
              send({
                type: "error",
                content: `Failed to execute: ${error instanceof Error ? error.message : "Unknown error"}`,
              });
            }
          } else {
            const history = messagesToGeminiHistory(messages);
            const response = await chatWithGemini(
              history,
              "I cancelled that action. Don't proceed with it."
            );
            const text =
              response.candidates?.[0]?.content?.parts?.[0]?.text ||
              "OK, action cancelled.";
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
        let response = await chatWithGemini(history, lastMessage.content);

        let iterations = 0;
        const MAX_ITERATIONS = 5;

        while (iterations < MAX_ITERATIONS) {
          const candidate = response.candidates?.[0];
          const parts: Part[] = candidate?.content?.parts || [];

          const functionCallPart = parts.find((p) => p.functionCall);

          if (!functionCallPart?.functionCall) {
            const text = parts
              .map((p) => p.text)
              .filter(Boolean)
              .join("");
            if (text) {
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
            send({
              type: "confirmation",
              pendingAction: {
                functionCall: { name, args },
                summary: summarizeAction(name, args),
              },
            });
            break;
          }

          // Read operation → execute immediately
          try {
            const result = await executeTool(name, args);

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

            // Update history for potential chaining
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
            send({
              type: "error",
              content: `Tool error: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
            break;
          }
        }

        if (iterations >= MAX_ITERATIONS) {
          send({
            type: "error",
            content: "Too many tool calls. Please try a simpler request.",
          });
        }
      } catch (error) {
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
