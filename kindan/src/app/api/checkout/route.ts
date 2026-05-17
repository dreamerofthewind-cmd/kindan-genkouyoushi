import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const CHARA_PRICES: Record<string, number> = {
  yamabuki: 500,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    let unitAmount: number;
    let productName: string;
    let successUrl: string;

    if (body.type === "revive") {
      // 原稿復活 ¥300
      unitAmount = 300;
      productName = "原稿復活";
      successUrl = `${appUrl}?success=revive`;
    } else {
      // キャラ購入
      const charaId: string = body.charaId;
      unitAmount = CHARA_PRICES[charaId] || body.price || 500;
      productName = `仲間「${charaId}」`;
      successUrl = `${appUrl}?success=chara&chara=${charaId}`;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              name: productName,
              description: "禁断の原稿用紙",
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: `${appUrl}?canceled=true`,
      locale: "ja",
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
