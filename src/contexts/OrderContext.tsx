import React, { createContext, useContext } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { OrderItem } from '../types';
import emailjs from '@emailjs/browser';

interface OrderContextType {
  sendOrder: (items: OrderItem[], userData: any) => Promise<void>;
}

const OrderContext = createContext<OrderContextType | null>(null);

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const sendOrder = async (items: OrderItem[], userData: any) => {
    try {
      if (!items.length) {
        throw new Error('Order cannot be empty');
      }

      // Prepare order data with proper type conversion
      const orderData = {
        items: items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          variantId: item.variantId,
          size: item.size,
          quantity: Number(item.quantity),
          price: Number(item.price),
          total: Number(item.quantity) * Number(item.price)
        })),
        userId: userData.id,
        userEmail: userData.email,
        companyName: userData.companyName,
        address: userData.address || '',
        contactNumber: userData.contactNumber || '',
        category: userData.category,
        status: 'pending',
        total: items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0),
        createdAt: serverTimestamp(),
        orderDate: new Date().toISOString()
      };

      // Save to Firestore
      const ordersRef = collection(db, 'orders');
      const orderRef = await addDoc(ordersRef, orderData);

      // Send email notification if configured
      if (process.env.VITE_EMAILJS_SERVICE_ID && 
          process.env.VITE_EMAILJS_TEMPLATE_ID && 
          process.env.VITE_EMAILJS_PUBLIC_KEY) {
        
        const orderSummary = items
          .map(item => `${item.productName} (${item.size}) - Quantity: ${item.quantity} - Price: €${(Number(item.price) * Number(item.quantity)).toFixed(2)}`)
          .join('\n');

        await emailjs.send(
          process.env.VITE_EMAILJS_SERVICE_ID,
          process.env.VITE_EMAILJS_TEMPLATE_ID,
          {
            to_email: process.env.VITE_ADMIN_EMAIL || 'admin@example.com',
            from_name: userData.companyName,
            message: `
Order ID: ${orderRef.id}

Company Details:
Company Name: ${userData.companyName}
Address: ${userData.address || 'N/A'}
Contact Number: ${userData.contactNumber || 'N/A'}
Email: ${userData.email}
Category: ${userData.category}

Order Summary:
${orderSummary}

Total: €${orderData.total.toFixed(2)}
`,
          },
          process.env.VITE_EMAILJS_PUBLIC_KEY
        );
      }

      return orderRef.id;
    } catch (error) {
      console.error('Error sending order:', error);
      throw new Error('Failed to send order. Please try again.');
    }
  };

  return (
    <OrderContext.Provider value={{ sendOrder }}>
      {children}
    </OrderContext.Provider>
  );
}