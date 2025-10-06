from flask import Flask, request, render_template, jsonify
import tensorflow as tf
from tensorflow.keras.preprocessing import image
import numpy as np
import os

# --- NEW: Import for Google Gemini API ---
import google.generativeai as genai

app = Flask(__name__)

# -----------------------------
# Load latest trained MobileNetV2 model
# -----------------------------
MODEL_PATH = r"C:\Users\admin\Desktop\tomacheck\models\tomato_leaf_classifier_v1.h5"

print(f"➡️ Loading model: {MODEL_PATH}")
model = tf.keras.models.load_model(MODEL_PATH)

# -----------------------------
# Class names: same as training
# -----------------------------
val_dir = r"C:\Users\admin\Desktop\tomacheck\valid"
class_names = sorted(os.listdir(val_dir))  # alphabetical order
print("➡️ Class mapping:", class_names)


# -----------------------------
# Helper: Preprocess image
# -----------------------------
def preprocess_image(img):
    # MobileNetV2 performs best at 224x224
    img = image.load_img(img, target_size=(224, 224))
    img_array = image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = img_array / 255.0
    return img_array

# --- NEW: Configure Google Gemini API ---
# IMPORTANT: Your API key should be set as an environment variable
# export GOOGLE_API_KEY="YOUR_API_KEY_HERE" (Linux/macOS)
# set GOOGLE_API_KEY="YOUR_API_KEY_HERE" (Windows cmd)
gemini_api_key = os.getenv("GOOGLE_API_KEY")
if not gemini_api_key:
    print("❌ ERROR: GOOGLE_API_KEY environment variable not set. Gemini API will not function.")
else:
    genai.configure(api_key=gemini_api_key)
    print("✅ Gemini API configured.")


# -----------------------------
# Frontend Route (No changes needed here for the new feature)
# -----------------------------
@app.route("/", methods=["GET", "POST"])
def index():
    prediction = None
    confidence = None

    if request.method == "POST":
        if "file" not in request.files:
            return render_template("index.html", prediction="No file uploaded")

        file = request.files["file"]
        if file.filename == "":
            return render_template("index.html", prediction="No file selected")

        os.makedirs("uploads", exist_ok=True)
        file_path = os.path.join("uploads", file.filename)
        file.save(file_path)

        img_array = preprocess_image(file_path)
        preds = model.predict(img_array)
        class_index = np.argmax(preds[0])
        prediction = class_names[class_index]
        confidence = round(float(np.max(preds[0])) * 100, 2)

        os.remove(file_path)

    return render_template("index.html", prediction=prediction, confidence=confidence)

# -----------------------------
# API Route (JSON) - No changes needed here for the new feature
# -----------------------------
@app.route("/predict", methods=["POST"])
def predict():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    os.makedirs("uploads", exist_ok=True)
    file_path = os.path.join("uploads", file.filename)
    file.save(file_path)

    img_array = preprocess_image(file_path)
    preds = model.predict(img_array)
    class_index = np.argmax(preds[0])
    prediction = class_names[class_index]
    confidence = float(np.max(preds[0]))

    os.remove(file_path)

    return jsonify({
        "prediction": prediction,
        "confidence": round(confidence, 4)
    })

# --- NEW: Gemini Recommendation Route ---
@app.route("/get_recommendation", methods=["POST"])
def get_recommendation():
    # Check if Gemini API is configured
    if not gemini_api_key:
        return jsonify({"error": "Gemini API key not configured. Cannot get recommendations."}), 503 # Service Unavailable

    try:
        data = request.get_json()
        disease_name = data.get("disease")

        if not disease_name:
            return jsonify({"error": "Disease name is required"}), 400

        # Special handling for "healthy" prediction
        if disease_name.lower() == "healthy":
            return jsonify({
                "recommendation": """
                <h5>Great News! Your plant appears healthy.</h5>
                <p>To keep your tomato plant thriving, here are some general tips:</p>
                <ul>
                    <li>Ensure adequate sunlight (6-8 hours daily).</li>
                    <li>Water consistently at the base of the plant to avoid leaf wetness.</li>
                    <li>Fertilize with a balanced tomato-specific fertilizer.</li>
                    <li>Provide good air circulation by proper spacing or pruning.</li>
                    <li>Monitor regularly for any early signs of pests or disease.</li>
                </ul>
                <p>Consistent care is the best prevention!</p>
                """
            })

        # Configure the Gemini model for generation
        generation_config = {
            "temperature": 0.4,
            "top_p": 1,
            "top_k": 32,
            "max_output_tokens": 4096,
        }
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash-exp",
            generation_config=generation_config,
        )

        # Create a detailed prompt for Gemini
        prompt = f"""
        You are an expert botanist and agricultural advisor. A user has identified '{disease_name}' on their tomato plant.
        Provide a clear, actionable management guide using Markdown.

        **Structure your response exactly as follows:**

        ### <i class="fa-solid fa-circle-info"></i> Description
        (A brief, easy-to-understand paragraph describing the disease.)

        ### <i class="fa-solid fa-toolbox"></i> Treatment & Management
        (A numbered list of actionable steps. Use **bolding** for key actions or products.)

        ### <i class="fa-solid fa-shield-halved"></i> Prevention
        (A numbered list of preventive measures.)

        Keep the tone helpful and direct for a home gardener. Use Font Awesome 6 solid icons as shown.
        """

        # Generate the content
        response = model.generate_content(prompt)

        # Return the response text to the frontend
        return jsonify({"recommendation": response.text})

    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        return jsonify({"error": "Failed to get recommendation from AI model."}), 500

# -----------------------------
# Run app
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)