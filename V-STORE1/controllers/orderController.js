import Order from "C:\Users\vtu16\OneDrive\Documents\GitHub\V-STORE1\V-STORE1\models\order.js";

export const createOrder = async (req, res) => {
  const {
    orderItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice
  } = req.body;

  if (!orderItems?.length) return res.status(400).json({ message: "No order items" });

  const order = await Order.create({
    user: req.user._id,
    orderItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice
  });

  res.status(201).json(order);
};

export const getMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort("-createdAt");
  res.json(orders);
};

export const getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email");
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json(order);
};

// Mock payment success (integrate Stripe/PayPal later)
export const payOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.isPaid = true;
  order.paidAt = new Date();
  order.paymentResult = {
    id: req.body.id || "MOCK_TXN_ID",
    status: "COMPLETED",
    update_time: new Date().toISOString(),
    email_address: req.user.email
  };

  await order.save();
  res.json({ message: "Payment recorded", order });
};

export const markDelivered = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  order.isDelivered = true;
  order.deliveredAt = new Date();
  await order.save();
  res.json({ message: "Order delivered", order });
};

export const getAllOrders = async (req, res) => {
  const orders = await Order.find().populate("user", "name email").sort("-createdAt");
  res.json(orders);
};
