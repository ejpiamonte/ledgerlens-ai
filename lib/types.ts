export type Risk='low'|'medium'|'high';
export type Status='auto_processed'|'approved'|'review_required'|'rejected'|'processing_failed';
export type LineItem={description:string;quantity:number;unit_price:number;amount:number;confidence:number};
export type Invoice={id:string;documentId:string;filename:string;vendor:string;invoiceNumber:string;invoiceDate:string;dueDate:string|null;poNumber:string|null;currency:string;subtotal:number;tax:number;total:number;confidence:number;risk:Risk;status:Status;reason:string;lineItems:LineItem[];validations:{name:string;status:'passed'|'warning'|'failed';message:string}[];createdAt:string;source:string};
export type RunStep={key:string;label:string;status:'success'|'warning'|'skipped'|'failed';durationMs:number;detail:string};
