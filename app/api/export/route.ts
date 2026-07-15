import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { getTransactionsPage } from "@/lib/data";

const csv=(value:unknown)=>`"${String(value??"").replaceAll('"','""')}"`;
const header=["Date","Type","Description","Account","Category / Source","Original amount","Currency","Amount PKR","Amount USD"];

export async function GET(request:NextRequest){
  if(!await readSession())return NextResponse.json({error:"Unauthorized"},{status:401});
  const month=request.nextUrl.searchParams.get("month")??undefined;const encoder=new TextEncoder();
  const stream=new ReadableStream({async start(controller){try{controller.enqueue(encoder.encode(`${header.map(csv).join(",")}\r\n`));let page=1;while(true){const batch=await getTransactionsPage({month,page,pageSize:500});for(const row of batch.items){controller.enqueue(encoder.encode(`${[row.transaction_date,row.type,row.description,row.accounts?.name,row.expense_categories?.name??row.income_sources?.name,row.original_amount,row.original_currency,row.amount_pkr,row.amount_usd].map(csv).join(",")}\r\n`))}if(page>=batch.totalPages)break;page++}controller.close()}catch(error){controller.error(error)}}});
  return new NextResponse(stream,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="ledgerly-${month??"all"}.csv"`}});
}
