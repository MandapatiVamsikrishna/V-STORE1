# models.py
from pymongo import MongoClient
from bson.objectid import ObjectId
import os
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(os.getenv('MONGO_URI'))
db = client['ecommerce_db']

class Product:
    collection = db['products']
    
    @classmethod
    def create(cls, data):
        return cls.collection.insert_one(data)
    
    @classmethod
    def find_all(cls):
        return list(cls.collection.find({}))
    
    @classmethod
    def find_by_id(cls, product_id):
        return cls.collection.find_one({'_id': ObjectId(product_id)})
    
    @classmethod
    def update_stock(cls, product_id, quantity):
        return cls.collection.update_one(
            {'_id': ObjectId(product_id)},
            {'$inc': {'stock': -quantity}}
        )

class User:
    collection = db['users']
    
    @classmethod
    def create(cls, user_data):
        return cls.collection.insert_one(user_data)
    
    @classmethod
    def find_by_email(cls, email):
        return cls.collection.find_one({'email': email})

class Order:
    collection = db['orders']
    
    @classmethod
    def create(cls, order_data):
        return cls.collection.insert_one(order_data)
    
    @classmethod
    def find_by_user(cls, user_id):
        return list(cls.collection.find({'user_id': user_id}))
from flask import Flask, jsonify, request
from flask_cors import CORS
from models import Product, User, Order
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='static')
CORS(app)

# Import route handlers
from routes.products import products_bp
from routes.users import users_bp
from routes.orders import orders_bp

# Register blueprints
app.register_blueprint(products_bp, url_prefix='/api/products')
app.register_blueprint(users_bp, url_prefix='/api/users')
app.register_blueprint(orders_bp, url_prefix='/api/orders')

@app.route('/')
def serve_frontend():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    app.run(debug=True)