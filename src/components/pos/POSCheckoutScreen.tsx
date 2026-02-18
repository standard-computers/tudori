import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Banknote, CreditCard, Gift, Loader2, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/lib/toast';

interface CartItem {
  product: {
    id: string;
    product_id: string;
    name: string;
    sku: string | null;
    price: number | null;
    image_url: string | null;
  };
  quantity: number;
}

interface LocationRate {
  id: string;
  name: string;
  rate: number;
  rate_type: string;
}

interface POSCheckoutScreenProps {
  cart: CartItem[];
  locationRates: LocationRate[];
  cartSubtotal: number;
  cartTotal: number;
  percentRates: LocationRate[];
  flatRates: LocationRate[];
  selectedLocationId: string;
  companyId: string;
  onBack: () => void;
  onComplete: () => void;
}

const POSCheckoutScreen = ({
  cart,
  locationRates,
  cartSubtotal,
  cartTotal,
  percentRates,
  flatRates,
  selectedLocationId,
  companyId,
  onBack,
  onComplete,
}: POSCheckoutScreenProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  const handlePayment = async (method: string) => {
    setPaymentMethod(method);
    setIsProcessing(true);

    try {
      // 1. Check if the location has an account
      const { data: accountData, error: accountError } = await supabase
        .from('accounts')
        .select('id, account_id, name')
        .eq('company_id', companyId)
        .eq('location_id', selectedLocationId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (accountError) throw accountError;

      if (!accountData) {
        toast.error('This location does not have an account. Please create an account for this location before processing POS orders.');
        setIsProcessing(false);
        setPaymentMethod(null);
        return;
      }

      // 2. Get next SO number
      const { data: soNumber, error: soNumError } = await supabase.rpc('get_next_so_number', {
        p_company_id: companyId,
      });
      if (soNumError) throw soNumError;

      // 3. Create sales order
      const taxAmount = cartTotal - cartSubtotal;
      const { data: order, error: orderError } = await supabase
        .from('sales_orders' as any)
        .insert({
          company_id: companyId,
          so_number: soNumber,
          status: 'confirmed',
          location_id: selectedLocationId,
          subtotal: cartSubtotal,
          tax_amount: taxAmount,
          total_amount: cartTotal,
          notes: `POS Order — ${method} payment`,
        })
        .select()
        .single();

      if (orderError) throw orderError;
      const orderId = (order as any).id;

      // 4. Create sales order items
      const itemsToInsert = cart.map((item) => ({
        sales_order_id: orderId,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price || 0,
        total_price: item.quantity * (item.product.price || 0),
      }));

      const { error: itemsError } = await supabase
        .from('sales_order_items' as any)
        .insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // 5. Create sales order tax rates if any
      if (locationRates.length > 0) {
        const taxRatesToInsert = locationRates.map((r) => ({
          sales_order_id: orderId,
          tax_rate_id: r.id,
          tax_amount:
            r.rate_type === 'percent'
              ? (cartSubtotal * r.rate) / 100
              : r.rate,
        }));

        await supabase.from('sales_order_tax_rates' as any).insert(taxRatesToInsert);
      }

      // 6. Get next invoice number
      const { data: invNumber, error: invNumError } = await supabase.rpc('get_next_invoice_number', {
        p_company_id: companyId,
      });
      if (invNumError) throw invNumError;

      // 7. Create invoice linked to the sales order and location account
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices' as any)
        .insert({
          company_id: companyId,
          invoice_number: invNumber,
          account_id: accountData.id,
          sales_order_id: orderId,
          invoice_date: new Date().toISOString().split('T')[0],
          subtotal: cartSubtotal,
          tax_amount: taxAmount,
          amount: cartTotal,
          status: 'paid',
          notes: `POS ${method} payment — ${soNumber}`,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;
      const invoiceId = (invoice as any).id;

      // 8. Create invoice items
      const invoiceItems = cart.map((item) => ({
        invoice_id: invoiceId,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price || 0,
        total_price: item.quantity * (item.product.price || 0),
      }));

      await supabase.from('invoice_items' as any).insert(invoiceItems);

      toast.success(`Order ${soNumber} completed — ${method} payment of $${cartTotal.toFixed(2)}`);
      onComplete();
    } catch (error: any) {
      console.error('POS checkout error:', error);
      toast.error(error.message || 'Failed to process order');
    } finally {
      setIsProcessing(false);
      setPaymentMethod(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 shrink-0 border-b">
        <div className="px-4">
          <div className="flex items-center gap-4 h-14">
            <Button variant="ghost" size="icon" onClick={onBack} disabled={isProcessing}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Checkout</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-8">
          {/* Order Summary */}
          <Card>
            <CardContent className="p-6 space-y-3">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>

              <div className="space-y-2 text-sm">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {item.product.name} × {item.quantity}
                    </span>
                    <span>${((item.product.price || 0) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${cartSubtotal.toFixed(2)}</span>
                </div>
                {percentRates.map((r) => (
                  <div key={r.id} className="flex justify-between text-sm text-muted-foreground">
                    <span>{r.name} ({r.rate}%)</span>
                    <span>${((cartSubtotal * r.rate) / 100).toFixed(2)}</span>
                  </div>
                ))}
                {flatRates.map((r) => (
                  <div key={r.id} className="flex justify-between text-sm text-muted-foreground">
                    <span>{r.name}</span>
                    <span>${r.rate.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 flex justify-between text-2xl font-bold">
                <span>Total</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Options */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-center">Select Payment Method</h2>
            <div className="grid grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-28 flex flex-col gap-2 text-base"
                onClick={() => handlePayment('Cash')}
                disabled={isProcessing}
              >
                {isProcessing && paymentMethod === 'Cash' ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <Banknote className="w-8 h-8" />
                )}
                Cash
              </Button>
              <Button
                variant="outline"
                className="h-28 flex flex-col gap-2 text-base"
                onClick={() => handlePayment('Card')}
                disabled={isProcessing}
              >
                {isProcessing && paymentMethod === 'Card' ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <CreditCard className="w-8 h-8" />
                )}
                Card
              </Button>
              <Button
                variant="outline"
                className="h-28 flex flex-col gap-2 text-base"
                onClick={() => handlePayment('Gift Card')}
                disabled={isProcessing}
              >
                {isProcessing && paymentMethod === 'Gift Card' ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <Gift className="w-8 h-8" />
                )}
                Gift Card
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default POSCheckoutScreen;
