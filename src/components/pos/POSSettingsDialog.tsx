import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import POSProductsTab from './POSProductsTab';
import POSRatesTab from './POSRatesTab';

interface POSSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  locationName: string;
  companyId: string;
  onSaved: () => void;
  showProductIds?: boolean;
  onShowProductIdsChange?: (value: boolean) => void;
  showProductImages?: boolean;
  onShowProductImagesChange?: (value: boolean) => void;
}

const POSSettingsDialog = ({
  open,
  onOpenChange,
  locationId,
  locationName,
  companyId,
  onSaved,
  showProductIds = false,
  onShowProductIdsChange,
  showProductImages = true,
  onShowProductImagesChange,
}: POSSettingsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>POS Settings — {locationName}</DialogTitle>
          <DialogDescription>
            Configure products and rates for this POS location.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="show-product-ids" className="text-sm font-medium cursor-pointer">
                Show Product IDs on tiles
              </Label>
              <Switch
                id="show-product-ids"
                checked={showProductIds}
                onCheckedChange={(checked) => onShowProductIdsChange?.(checked)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="show-product-images" className="text-sm font-medium cursor-pointer">
                Show Product Images on tiles
              </Label>
              <Switch
                id="show-product-images"
                checked={showProductImages}
                onCheckedChange={(checked) => onShowProductImagesChange?.(checked)}
              />
            </div>

            <Tabs defaultValue="products">
              <TabsList className="w-full">
                <TabsTrigger value="products" className="flex-1">Products</TabsTrigger>
                <TabsTrigger value="rates" className="flex-1">Rates</TabsTrigger>
              </TabsList>
              <TabsContent value="products">
                <POSProductsTab
                  locationId={locationId}
                  companyId={companyId}
                  onSaved={onSaved}
                />
              </TabsContent>
              <TabsContent value="rates">
                <POSRatesTab
                  locationId={locationId}
                  companyId={companyId}
                  onSaved={onSaved}
                />
              </TabsContent>
            </Tabs>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default POSSettingsDialog;
