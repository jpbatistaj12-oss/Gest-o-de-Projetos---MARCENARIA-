
import { GoogleGenAI } from "@google/genai";
import { Project } from "../types";

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  private getClient() {
    if (!this.ai) {
      // Verificação mais robusta para ambientes onde window.process pode ser instável
      const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) 
        ? process.env.API_KEY 
        : (window as any).process?.env?.API_KEY || '';
      
      this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
    }
    return this.ai;
  }

  async generateProjectSummary(project: Project): Promise<string> {
    try {
      const client = this.getClient();
      const prompt = `
        Analise o status deste projeto de marmoraria:
        Cliente: ${project.clientName}
        Ambientes: ${project.environments.map(e => `${e.name} (R$ ${e.value})`).join(', ')}
        
        Gere uma análise rápida de 2 frases focada em produtividade.
      `;

      const response = await client.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      return response.text || "Análise indisponível no momento.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Erro ao processar análise inteligente.";
    }
  }
}

export const geminiService = new GeminiService();
