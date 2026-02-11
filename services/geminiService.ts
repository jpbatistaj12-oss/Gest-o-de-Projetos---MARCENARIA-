
import { GoogleGenAI } from "@google/genai";
import { Project } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // Correctly initialize with process.env.API_KEY as per guidelines
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateProjectSummary(project: Project): Promise<string> {
    try {
      const prompt = `
        Aja como um consultor de marmoraria. Analise o seguinte projeto:
        Cliente: ${project.clientName}
        Status: ${project.status}
        Ambientes: ${project.environments.map(e => `${e.name} (R$ ${e.value})`).join(', ')}
        
        Gere uma breve análise (3 frases) sobre o status financeiro e logístico deste projeto, dando uma dica prática para a finalização ou otimização do lucro.
      `;

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      return response.text || "Não foi possível gerar uma análise automática no momento.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Erro ao conectar com assistente inteligente.";
    }
  }
}

export const geminiService = new GeminiService();
