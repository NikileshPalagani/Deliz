import React, { useState } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  Building2,
  Coins,
  CreditCard,
  RefreshCw,
  Smartphone,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BLOCKS } from '../../types';
import { apiFetch } from '../../utils/api';
import { DirectUpiPayment } from './DirectUpiPayment';

export const CartModal = () => {
  const {
    currentUser,
    isCartOpen,
    setIsCartOpen,
    cartItemsDetailed,
    cartTotalAmount,
    cartTotalQuantity,
    addToCart,
    clearCart,
    selectedBlock,
    setSelectedBlock,
    coinsToRedeem,
    setCoinsToRedeem,
    validCoinsRedeemed,
    coinDiscountInRupees,
    potentialCoinsEarned,
    maxRedeemableCoins,
    finalPayableAmount,
    fulfillVerifiedOrder,
  } = useApp();

  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [showDirectUpi, setShowDirectUpi] = useState(false);

  if (!isCartOpen && !showDirectUpi) return null;

  // Live Razorpay Payment Verification & Order Generation
  const executePaymentVerification = async (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
    try {
      setRazorpayLoading(true);
      setPaymentError('');

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        setPaymentError('Incomplete payment response from gateway.');
        setRazorpayLoading(false);
        return;
      }

      const verifyData = await apiFetch('/api/verify-payment', {
        method: 'POST',
        body: JSON.stringify({
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          orderPayload: {
            studentEmail: currentUser?.email || 'student@cvr.ac.in',
            studentName: currentUser?.name || 'Student',
            studentPhone: currentUser?.phone || '',
            block: selectedBlock,
            items: cartItemsDetailed.map(i => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              isVeg: i.isVeg,
            })),
            totalAmount: cartTotalAmount,
            discount: coinDiscountInRupees,
            finalAmount: finalPayableAmount,
            coinsEarned: potentialCoinsEarned,
            coinsRedeemed: validCoinsRedeemed,
          }
        })
      });

      if (verifyData.success && verifyData.verified && verifyData.order) {
        // Fulfill verified order, trigger celebration confetti, and show Token QR Code
        fulfillVerifiedOrder(verifyData.order);
      } else {
        setPaymentError(verifyData.message || 'Payment verification failed. Please contact support.');
      }
    } catch (err) {
      console.error('Payment verification error:', err);
      setPaymentError('Network error verifying payment with server.');
    } finally {
      setRazorpayLoading(false);
    }
  };

  const handleRazorpayPayment = async () => {
    try {
      setPaymentError('');
      setRazorpayLoading(true);

      // 1. Backend: Create Razorpay Order with full cart items for server-side price validation
      const orderData = await apiFetch('/api/create-order', {
        method: 'POST',
        body: JSON.stringify({
          items: cartItemsDetailed.map(i => ({
            id: i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            isVeg: i.isVeg,
          })),
          coinsToRedeem: validCoinsRedeemed,
          studentEmail: currentUser?.email || 'student@cvr.ac.in',
          currency: 'INR',
          receipt: `rcpt_${Date.now()}`,
          notes: {
            studentEmail: currentUser?.email || 'student@cvr.ac.in',
            block: selectedBlock
          }
        })
      });

      if (!orderData.success) {
        console.warn('Backend order init notice:', orderData.message);
        setPaymentError(orderData.message || 'Failed to initialize payment gateway.');
        setRazorpayLoading(false);
        return;
      }

      const keyId = orderData.key_id || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_RAZORPAY_KEY_ID) || '';

      // Ensure Razorpay checkout script is loaded
      if (typeof window.Razorpay === 'undefined') {
        try {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => reject(new Error('SDK load error'));
            document.body.appendChild(script);
          });
        } catch (scriptErr) {
          console.warn('Razorpay SDK load error:', scriptErr);
          setPaymentError('Payment gateway script failed to load. Please check your internet connection.');
          setRazorpayLoading(false);
          return;
        }
      }

      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Deliz',
        description: `Deliz Food Pickup • ${selectedBlock}`,
        image: '/images/deliz-icon.png',
        order_id: orderData.order_id,
        prefill: {
          name: currentUser?.name || 'Student',
          email: currentUser?.email || 'student@cvr.ac.in',
          contact: currentUser?.phone && currentUser.phone.length === 10 ? currentUser.phone : '9999999999',
        },
        theme: {
          color: '#f97316',
        },
        handler: async function (response) {
          // Cryptographically verify signature on server and generate order + QR code
          await executePaymentVerification(
            response.razorpay_order_id,
            response.razorpay_payment_id,
            response.razorpay_signature
          );
        },
        modal: {
          ondismiss: function () {
            console.log('Razorpay modal closed.');
            setPaymentError('Payment window was closed. You can retry paying when ready.');
            setRazorpayLoading(false);
            apiFetch('/api/payment-failed', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_order_id: orderData.order_id,
                error: { description: 'Payment modal dismissed by student' },
                studentEmail: currentUser?.email,
                amount: finalPayableAmount,
              })
            }).catch(() => {});
          }
        }
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', function (resp) {
        console.error('Razorpay payment failed:', resp.error);
        setPaymentError(resp.error?.description || 'Payment was not completed. Please try again.');
        setRazorpayLoading(false);
        apiFetch('/api/payment-failed', {
          method: 'POST',
          body: JSON.stringify({
            razorpay_order_id: orderData.order_id,
            razorpay_payment_id: resp.error?.metadata?.payment_id,
            error: resp.error,
            studentEmail: currentUser?.email,
            amount: finalPayableAmount,
          })
        }).catch(() => {});
      });

      rzp.open();

    } catch (e) {
      console.error('Razorpay invocation exception:', e);
      setPaymentError('Payment gateway could not be launched. Please try again.');
      setRazorpayLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in flex justify-end">
        <div
          onClick={() => setIsCartOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        <div className="relative w-full max-w-md bg-[#111827] border-l border-gray-800 text-gray-100 flex flex-col h-full shadow-2xl z-10">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#0B0F19]/60">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white">Your Cart</h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30">
                {cartTotalQuantity} {cartTotalQuantity === 1 ? 'item' : 'items'}
              </span>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {paymentError && (
              <div className="p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-2xl text-xs text-rose-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-rose-100 flex items-center gap-1.5">
                    <span>⚠️ Payment Alert</span>
                  </div>
                </div>
                <p className="text-[11px] text-rose-300 leading-relaxed">{paymentError}</p>
                <button
                  onClick={handleRazorpayPayment}
                  disabled={razorpayLoading}
                  className="w-full py-2 px-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 text-xs shadow-md active:scale-98"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Payment with Razorpay</span>
                </button>
              </div>
            )}

            {cartItemsDetailed.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-5xl mb-3">🛒</div>
                <h4 className="text-base font-bold text-white mb-1">Your cart is empty</h4>
                <p className="text-xs text-gray-400 max-w-xs mx-auto mb-5">
                  Add samosa or puffs from the menu to get started!
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded-xl shadow-lg transition active:scale-95"
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-gray-400 font-semibold uppercase tracking-wider">
                    <span>Order Items</span>
                    <button
                      onClick={clearCart}
                      className="text-rose-400 hover:text-rose-300 font-normal text-xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  </div>

                  {cartItemsDetailed.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-gray-900/80 border border-gray-800 rounded-2xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={item.image}
                          alt={item.name}
                          onError={(e) => { e.target.src = item.fallbackImage; }}
                          className="w-12 h-12 rounded-xl object-cover bg-gray-800 shrink-0"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-white">{item.name}</h4>
                          <div className="text-xs text-orange-400 font-semibold mt-0.5">
                            ₹{item.price} each
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-xl p-1">
                        <button
                          onClick={() => addToCart(item.id, -1)}
                          className="w-6 h-6 rounded bg-gray-700 text-gray-200 flex items-center justify-center transition active:scale-90"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-extrabold text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => addToCart(item.id, 1)}
                          className="w-6 h-6 rounded bg-orange-500 text-white flex items-center justify-center transition active:scale-90"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 bg-gray-900/90 border border-gray-800 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Building2 className="w-4 h-4 text-orange-400" />
                    <span>Select Campus Block</span>
                  </div>

                  <div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {BLOCKS.map((b) => (
                        <button
                          key={b.code}
                          onClick={() => setSelectedBlock(b.code)}
                          className={`py-2 px-1 rounded-xl text-xs font-bold text-center transition border ${
                            selectedBlock === b.code
                              ? 'bg-orange-500 text-white border-orange-400 shadow-md'
                              : 'bg-gray-800 text-gray-300 border-gray-700 active:bg-gray-700'
                          }`}
                          title={b.name}
                        >
                          <div>{b.code}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      Selected Block: <span className="text-orange-400 font-semibold">{BLOCKS.find(b => b.code === selectedBlock)?.name}</span>
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-gradient-to-r from-amber-950/40 to-orange-950/40 border border-amber-500/40 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                      <Coins className="w-3.5 h-3.5" />
                      <span>Coin Balance:</span>
                    </div>
                    <span className="font-extrabold text-amber-300 text-xs">
                      🪙 {currentUser?.coins ?? 0} Coins
                    </span>
                  </div>

                  <div className="text-[10px] text-gray-400 flex items-center justify-between">
                    <span>Rate: <strong>10 Coins = ₹1</strong></span>
                    <span>Earn: <strong>1 Coin per ₹5</strong></span>
                  </div>

                  {maxRedeemableCoins >= 10 ? (
                    <div className="pt-2 border-t border-amber-900/40">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-300">Redeem:</span>
                        <span className="font-bold text-orange-400">
                          {validCoinsRedeemed} Coins (-₹{coinDiscountInRupees})
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={maxRedeemableCoins}
                        step={10}
                        value={coinsToRedeem}
                        onChange={(e) => setCoinsToRedeem(Number(e.target.value))}
                        className="w-full accent-orange-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                        <span>0</span>
                        <button
                          onClick={() => setCoinsToRedeem(maxRedeemableCoins)}
                          className="text-orange-400 hover:underline font-semibold"
                        >
                          Use Max ({maxRedeemableCoins} Coins)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-amber-200/80 pt-0.5">
                      ✨ Spend ₹{finalPayableAmount} on this order to earn +{potentialCoinsEarned} Coins!
                    </p>
                  )}
                </div>

                <div className="p-3.5 bg-gray-900/60 border border-gray-800 rounded-2xl space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-400">
                    <span>Items Subtotal:</span>
                    <span className="font-medium text-white">₹{cartTotalAmount}</span>
                  </div>
                  {coinDiscountInRupees > 0 && (
                    <div className="flex justify-between text-orange-400 font-semibold">
                      <span>Coin Discount ({validCoinsRedeemed} Coins):</span>
                      <span>-₹{coinDiscountInRupees}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-400">
                    <span>Counter Pickup:</span>
                    <span className="text-orange-400 font-medium">FREE</span>
                  </div>
                  <div className="pt-2 border-t border-gray-800 flex justify-between text-sm font-black text-white">
                    <span>Total Payable:</span>
                    <span className="text-orange-400 text-base">₹{finalPayableAmount}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {cartItemsDetailed.length > 0 && (
            <div className="p-4 border-t border-gray-800 bg-[#0B0F19]/90 space-y-2.5">
              {/* Verified Razorpay Payment Gateway Checkout */}
              <button
                onClick={handleRazorpayPayment}
                disabled={razorpayLoading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black rounded-2xl shadow-lg shadow-orange-500/25 transition flex items-center justify-center gap-2 text-sm active:scale-98 min-h-[48px] disabled:opacity-50 cursor-pointer"
              >
                {razorpayLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Opening Razorpay Gateway...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-white" />
                    <span>Pay ₹{finalPayableAmount} (Online Gateway)</span>
                  </>
                )}
              </button>

              {/* Direct UPI App Option */}
              <button
                type="button"
                onClick={() => setShowDirectUpi(true)}
                disabled={razorpayLoading}
                className="w-full py-3 px-4 bg-gray-800/90 hover:bg-gray-700/90 border border-gray-700 text-gray-200 font-bold rounded-2xl transition flex items-center justify-center gap-2 text-xs active:scale-98 cursor-pointer"
              >
                <Smartphone className="w-4 h-4 text-orange-400" />
                <span>Pay via UPI App (PhonePe / GPay / Paytm)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showDirectUpi && (
        <DirectUpiPayment
          isOpen={showDirectUpi}
          onClose={() => {
            setShowDirectUpi(false);
            setIsCartOpen(false);
          }}
        />
      )}
    </>
  );
};
