import { GeneralChat } from "@chaingpt/generalchat";
import { SmartContractAuditor } from "@chaingpt/smartcontractauditor";

export class ChainGPTClient {
    private chatClient: GeneralChat;
    private apiKey: string;
    private auditorClient: SmartContractAuditor;

    constructor() {
        this.apiKey = process.env.NEXT_PUBLIC_CHAINGPT_API_KEY!;
        this.chatClient = new GeneralChat({
            apiKey: this.apiKey
        });
        this.auditorClient = new SmartContractAuditor({
            apiKey: this.apiKey,
        });
    }

    async chat(question: string, userId: string) {
        return this.chatClient.createChatStream({
            question,
            chatHistory: userId ? "on" : "off",
            sdkUniqueId: userId || undefined,
        });
    }

    async auditContract(contractCode: string, userId: string) {
        return this.auditorClient.auditSmartContractStream({
            question: contractCode,
            chatHistory: userId ? "on" : "off",
            sdkUniqueId: userId || undefined
        })
    }

    // async generateContract(description: string) {
    //     const response = await fetch()
    // }

    async *streamToText(stream: ReadableStream<Uint8Array>) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                yield chunk;
            }
        } finally {
            reader.releaseLock();
        }
    }
}

export const chainGPTClient = new ChainGPTClient();