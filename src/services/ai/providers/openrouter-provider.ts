import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { Message } from '../types';
import { AILogger } from '../utils/logger';
import { BASE_SYSTEM_PROMPT } from '../utils/base-prompts';

/**
 * Provider class that communicates with OpenRouter service
 */
export class OpenRouterProvider {
    private logger: AILogger;
    
    constructor(private context: vscode.ExtensionContext) {
        this.logger = new AILogger();
    }
    
    /**
     * Sends a request to OpenRouter API
     */
    public async callOpenRouter(userMessage: string, messages: Message[]): Promise<string> {
        // Get API key from secret storage
        let apiKey = await this.getApiKey();
        
        if (!apiKey) {
            throw new Error('OpenRouter API key not found. Please configure it.');
        }
        
        // Create message history in OpenRouter chat format
        const formattedMessages = this.formatMessages(messages);
        formattedMessages.push({ role: 'user', content: userMessage });
        
        this.logger.log('Sending OpenRouter API request...');
        
        try {
            const config = vscode.workspace.getConfiguration('byte');
            const model = config.get<string>('openrouter.model') || 'gpt-3.5-turbo';
            
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: formattedMessages,
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenRouter API Error: ${response.status} - ${JSON.stringify(errorData)}`);
            }
            
            const data = await response.json();
            const assistantResponse = data.choices[0].message.content;
            
            this.logger.log('OpenRouter API response received');
            return assistantResponse;
        } catch (error: any) {
            this.logger.log(`OpenRouter API Error: ${error.message}`, true);
            throw new Error(`OpenRouter API request failed: ${error.message}`);
        }
    }
    
    /**
     * Converts messages to OpenRouter API format
     */
    private formatMessages(messages: Message[]): any[] {
        // Add system message with enhanced prompt
        const formattedMessages = [
            { 
                role: 'system', 
                content: BASE_SYSTEM_PROMPT
            }
        ];
        
        // Add last 10 messages (limit)
        const recentMessages = messages.slice(-10);
        recentMessages.forEach(message => {
            formattedMessages.push({
                role: message.role,
                content: message.content
            });
        });
        
        return formattedMessages;
    }
    
    /**
     * Gets OpenRouter API key from secure storage
     */
    public async getApiKey(): Promise<string | undefined> {
        // First try to get the key from secret storage
        let apiKey = await this.context.secrets.get('byte.openrouter.apiKey');
        
        // If not in secret storage, get from settings
        if (!apiKey) {
            const config = vscode.workspace.getConfiguration('byte');
            apiKey = config.get<string>('openrouter.apiKey');
        }
        
        return apiKey;
    }
    
    /**
     * Saves OpenRouter API key to secure storage
     */
    public async setApiKey(apiKey: string): Promise<void> {
        await this.context.secrets.store('byte.openrouter.apiKey', apiKey);
        this.logger.log('OpenRouter API key saved to secure storage');
    }
}