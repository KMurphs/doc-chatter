import pymupdf as  fitz # PyMuPDF
import boto3
import re
import os
from pydub import AudioSegment

chapter_titles = [
"System Design Interviews: A step by step guide Designing a URL Shortening service like TinyURL",
"Designing Pastebin",
"Designing Instagram",
"Designing Dropbox",
"Designing Facebook Messenger",
"Designing Twitter",
"Designing Youtube or Netflix",
"Designing Typeahead Suggestion",
"Designing an API Rate Limiter",
"Designing Twitter Search Designing a Web Crawler",
"Designing Facebook's Newsfeed",
"Designing Yelp or Nearby Friends",
"Designing Uber backend",
"Design Ticketmaster (\\*New\\*)",
"Additional Resources",
]




def extract_chapters_from_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text()
    
    chapter_pattern = re.compile(rf'{"|".join(map(re.escape, chapter_titles))}', re.IGNORECASE)
    chapters = []
    current_title = "Introduction"
    current_text = ""

    for line in full_text.splitlines():
        if chapter_pattern.match(line.strip()):
            if current_text:
                chapters.append((current_title, current_text.strip()))
            current_title = line.strip()
            current_text = ""
        else:
            current_text += line + "\n"

    if current_text:
        chapters.append((current_title, current_text.strip()))

    return chapters

def prepare_text_for_ssml(text):
    # Escape special characters
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace('</', ' ')
    text = text.replace('&', ' and ')
    return text.strip()


def create_ssml_text(text, is_title=False):
    """Create SSML with supported tags"""
    # Clean the text of any existing XML-like content
    text = prepare_text_for_ssml(text)
    
    if is_title:
        ssml = f"""<speak>
            <amazon:effect name="drc">{text}</amazon:effect>
            <break time="1.5s"/>
        </speak>"""
    else:
        ssml = f"""<speak>
            <amazon:effect name="drc">{text}</amazon:effect>
            <break time="1s"/>
        </speak>"""
    
    return ssml.strip()

def chunk_text(text, max_chars=2900):
    """Split text into chunks respecting sentence boundaries"""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = []
    current_length = 0
    
    for sentence in sentences:
        sentence_len = len(sentence)
        if current_length + sentence_len + 1 <= max_chars:
            current_chunk.append(sentence)
            current_length += sentence_len + 1
        else:
            if current_chunk:
                chunks.append(' '.join(current_chunk))
            current_chunk = [sentence]
            current_length = sentence_len
    
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    return chunks

def synthesize_speech(text, output_file, voice_id='Joanna'):
    """Synthesize speech using Amazon Polly"""
    polly = boto3.client('polly')
    try:
        response = polly.synthesize_speech(
            Engine='neural',
            Text=text,
            TextType='ssml',
            OutputFormat='mp3',
            VoiceId=voice_id
        )
        
        with open(output_file, 'wb') as file:
            file.write(response['AudioStream'].read())
        return True
    except Exception as e:
        print(f"Error synthesizing speech: {e}")
        return False

def process_chapter(chapter_title, chapter_text, output_dir, chapter_num):
    """Process a single chapter"""
    chapter_dir = os.path.join(output_dir, f'chapter_{chapter_num:02d}')
    os.makedirs(chapter_dir, exist_ok=True)
    
    # Process title
    title_ssml = create_ssml_text(chapter_title, is_title=True)
    title_file = os.path.join(chapter_dir, f'00_title.mp3')
    synthesize_speech(title_ssml, title_file)
    
    # Process content
    audio_segments = [AudioSegment.from_mp3(title_file)]
    chunks = chunk_text(chapter_text)
    
    for i, chunk in enumerate(chunks, 1):
        chunk_file = os.path.join(chapter_dir, f'{i:02d}_chunk.mp3')
        chunk_ssml = create_ssml_text(chunk)
        if synthesize_speech(chunk_ssml, chunk_file):
            audio_segments.append(AudioSegment.from_mp3(chunk_file))
            audio_segments.append(AudioSegment.silent(duration=500))  # 0.5s gap
    
    # Combine chapter audio
    chapter_audio = sum(audio_segments)
    chapter_file = os.path.join(output_dir, f'chapter_{chapter_num:02d}.mp3')
    chapter_audio.export(chapter_file, format='mp3')
    return chapter_file

def build_audiobook(pdf_path, output_dir='audiobook_output'):
    """Main function to build the audiobook"""
    os.makedirs(output_dir, exist_ok=True)
    chapters = extract_chapters_from_pdf(pdf_path)
    chapter_files = []
    
    for i, (title, content) in enumerate(chapters, 1):
        print(f"Processing Chapter {i}: {title}")
        chapter_file = process_chapter(title, content, output_dir, i)
        chapter_files.append(chapter_file)
    
    # Combine all chapters
    final_audio = AudioSegment.empty()
    for file in chapter_files:
        final_audio += AudioSegment.from_mp3(file) + AudioSegment.silent(duration=1000)
    
    final_audio.export(os.path.join(output_dir, 'complete_audiobook.mp3'), format='mp3')
    print("Audiobook creation complete!")


# === Run it ===
if __name__ == "__main__":
    build_audiobook("/Users/kibonges/Downloads/Grokking the System Design Interview.pdf")


# aws polly synthesize-speech \
#     --engine neural \
#     --text-type ssml \
#     --output-format mp3 \
#     --voice-id Joanna \
#     --text "<speak>            <amazon:effect name=\"drc\"> If we support playing pausing a video from multiple devices, we will need to store the offset on the server. This will enable the users to start watching a video on anydevice from the same point where they left off. codec (string)  resolution(string): We should send the codec and resolution info in the API from .</amazon:effect>            <break time=\"1s\"/>        </speak>" \
#     polly_out0.mp3