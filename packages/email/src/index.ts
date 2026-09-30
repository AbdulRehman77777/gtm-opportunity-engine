import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export type SendEmailInput={from:string;replyTo?:string|undefined;to:string;subject:string;text:string;html?:string|null;messageId?:string;inReplyTo?:string;references?:string[];attachments?:Array<{filename:string;path:string;contentType?:string}>};
export type SendEmailResult={messageId:string;response?:unknown};
export interface EmailProvider { send(input:SendEmailInput):Promise<SendEmailResult>; healthCheck():Promise<{status:'available'|'unavailable'|'misconfigured';detail?:string}>; }
export interface EmailInboxProvider { poll(checkpoint:{lastUid:number},mailbox?:string):Promise<{uidValidity?:string;lastUid:number;messages:InboundEmail[]}>; healthCheck():Promise<{status:'available'|'unavailable'|'misconfigured';detail?:string}>; }
export type InboundEmail={uid:number;messageId:string;inReplyTo?:string;references:string[];sender:string;recipients:string[];subject:string;textBody:string;occurredAt:string;rawMetadata:Record<string,unknown>};

export class SMTPProvider implements EmailProvider {
  private transporter;
  constructor(private readonly config:{host?:string|undefined;port:number;secure:boolean;user?:string|undefined;password?:string|undefined},transport?:ReturnType<typeof nodemailer.createTransport>){this.transporter=transport??(config.host?nodemailer.createTransport({host:config.host,port:config.port,secure:config.secure,auth:config.user?{user:config.user,pass:config.password}:undefined}):null);}
  async send(input:SendEmailInput){if(!this.transporter)throw new Error('SMTP is misconfigured');const result=await this.transporter.sendMail({from:input.from,replyTo:input.replyTo,to:input.to,subject:input.subject,text:input.text,html:input.html??undefined,messageId:input.messageId,inReplyTo:input.inReplyTo,references:input.references,attachments:input.attachments});return{messageId:result.messageId,response:{accepted:result.accepted,rejected:result.rejected,response:result.response}};}
  async healthCheck(){if(!this.transporter)return{status:'misconfigured' as const,detail:'SMTP_HOST is not configured'};try{await this.transporter.verify();return{status:'available' as const};}catch(error){return{status:'unavailable' as const,detail:error instanceof Error?error.message:String(error)};}}
}

export class ImapInboxProvider implements EmailInboxProvider {
  constructor(private readonly config:{host?:string|undefined;port:number;secure:boolean;user?:string|undefined;password?:string|undefined}){}
  private client(){if(!this.config.host||!this.config.user||!this.config.password)throw new Error('IMAP is misconfigured');return new ImapFlow({host:this.config.host,port:this.config.port,secure:this.config.secure,auth:{user:this.config.user,pass:this.config.password},logger:false});}
  async poll(checkpoint:{lastUid:number},mailbox='INBOX'){const client=this.client();await client.connect();try{const lock=await client.getMailboxLock(mailbox);try{const messages:InboundEmail[]=[];const start=Math.max(1,checkpoint.lastUid+1);for await(const message of client.fetch(`${start}:*`,{uid:true,envelope:true,source:true})){if(message.uid<=checkpoint.lastUid||!message.source)continue;const parsed=await simpleParser(message.source);messages.push({uid:message.uid,messageId:parsed.messageId??`imap-${message.uid}`,...(parsed.inReplyTo?{inReplyTo:parsed.inReplyTo}:{}),references:Array.isArray(parsed.references)?parsed.references:parsed.references?[parsed.references]:[],sender:parsed.from?.value[0]?.address??'',recipients:parsed.to&&'value'in parsed.to?parsed.to.value.map((item)=>item.address??''):[],subject:parsed.subject??'',textBody:parsed.text??'',occurredAt:(parsed.date??new Date()).toISOString(),rawMetadata:{uid:message.uid}});}return{lastUid:messages.at(-1)?.uid??checkpoint.lastUid,messages};}finally{lock.release();}}finally{await client.logout();}}
  async healthCheck(){try{const client=this.client();await client.connect();await client.logout();return{status:'available' as const};}catch(error){return{status:/misconfigured/.test(String(error))?'misconfigured' as const:'unavailable' as const,detail:error instanceof Error?error.message:String(error)};}}
}

export class MemoryEmailProvider implements EmailProvider { readonly sent:SendEmailInput[]=[];async send(input:SendEmailInput){this.sent.push(input);return{messageId:`<mock-${this.sent.length}@local>`};}async healthCheck(){return{status:'available' as const};}}
