import base64
import json
import requests
import os

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def analyze_image_and_description(image_path, description, obstacle_type):
    if not GEN_AI_KEY:
        raise ValueError("Gemini API key not configured")

    # Encode image
    base64_image = encode_image(image_path)
    
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEN_AI_KEY
    }

    payload = {
        "contents": [{
            "parts": [
                {
                    "text": f"""Please analyze this image and compare it to the following description: "{description}".
                    The reported obstacle type is: "{obstacle_type}".
                    Rate the accuracy of the description and obstacle type from 0% to 100%, {{percentage}}, 
                    along with an explanation, {{reason}} (please keep the explaination at 1 sentence long at maximum). Then, return a json with the format
                    {{
                        'rating' : {{percentage}},
                        'reason' : {{reason}},
                    }}.
                    Nothing else"""
                },
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": base64_image
                    }
                }
            ]
        }]
    }

    response = requests.post(
        "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent",
        headers=headers,
        json=payload
    )

    if response.status_code != 200:
        raise Exception(f"API request failed with status {response.status_code}: {response.text}")

    try:
        result = response.json()
        analysis_text = result['candidates'][0]['content']['parts'][0]['text']
        
        # Try to parse the JSON response
        try:
            analysis_json = json.loads(analysis_text)
            return {
                'accuracy': int(analysis_json['rating']),
                'analysis': analysis_json['reason']
            }
        except json.JSONDecodeError:
            import re
            percentage_match = re.search(r'(\d+)%', analysis_text)
            return {
                'accuracy': int(percentage_match.group(1)) if percentage_match else None,
                'analysis': analysis_text
            }
            
    except Exception as e:
        raise Exception(f"Error processing API response: {str(e)}")

def main():
    # Option 1: Use relative path from current directory
    image_path = "./pic.jpeg"
    
    description = "A pothole"
    obstacle_type = "Road Damage"
    
    # Add debug print
    print(f"Looking for image at: {os.path.abspath(image_path)}")
    
    # Check if file exists
    if not os.path.exists(image_path):
        print(f"Error: Image file not found at {image_path}")
        return
        
    try:
        result = analyze_image_and_description(image_path, description, obstacle_type)
        print("Analysis Result:")
        print(f"Accuracy: {result['accuracy']}%")
        print(f"Analysis: {result['analysis']}")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()
