import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, Trash2 } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { Purchase } from '../index';

const purchaseSchema = z.object({
  date: z.string(),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().positive(),
});

type PurchaseFormData = z.infer<typeof purchaseSchema>;

interface PurchaseHistoryProps {
  referenceId: string;
  purchases: Purchase[];
}

export function PurchaseHistory({ referenceId, purchases }: PurchaseHistoryProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);
  const [editingPurchase, setEditingPurchase] = React.useState<Purchase | null>(null);

  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      quantity: 1,
      price: 0,
    },
  });

  const createPurchase = useMutation({
    mutationFn: (data: PurchaseFormData) =>
      fetch(`http://localhost:8000/api/ref/${referenceId}/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['references'] });
      queryClient.invalidateQueries({ queryKey: ['reference', referenceId] });
      setShowForm(false);
      form.reset();
    },
  });

  const updatePurchase = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PurchaseFormData }) =>
      fetch(`http://localhost:8000/api/purchase/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['references'] });
      queryClient.invalidateQueries({ queryKey: ['reference', referenceId] });
      setEditingPurchase(null);
      form.reset();
    },
  });

  const deletePurchase = useMutation({
    mutationFn: (id: number) =>
      fetch(`http://localhost:8000/api/purchase/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['references'] });
      queryClient.invalidateQueries({ queryKey: ['reference', referenceId] });
    },
  });

  const handleSubmit = (data: PurchaseFormData) => {
    if (editingPurchase) {
      updatePurchase.mutate({ id: editingPurchase.id, data });
    } else {
      createPurchase.mutate(data);
    }
  };

  const handleEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    form.setValue('date', purchase.date);
    form.setValue('quantity', purchase.quantity);
    form.setValue('price', purchase.price);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingPurchase(null);
    form.reset();
  };

  const totalQuantity = purchases.reduce((sum, p) => sum + p.quantity, 0);
  const totalValue = purchases.reduce((sum, p) => sum + (p.price * p.quantity), 0);
  const averagePrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Purchase History</h3>
        <Button
          onClick={() => setShowForm(true)}
          size="sm"
          disabled={showForm}
        >
          +
        </Button>
      </div>

      {showForm && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 p-4 border rounded">
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex space-x-2">
              <Button type="submit" size="sm">
                {editingPurchase ? 'Update' : 'Add'} Purchase
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      )}

      {purchases.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>{purchase.date}</TableCell>
                  <TableCell>{purchase.quantity}</TableCell>
                  <TableCell>€{purchase.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(purchase)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePurchase.mutate(purchase.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {purchases.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No purchases recorded yet.
        </div>
      )}
    </div>
  );
}