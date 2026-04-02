# =============================================================================
# AI Service — LangChain Generator
# =============================================================================
# Executes the LangChain pipeline to generate problems using Hugging Face endpoints.
# =============================================================================

import os
from langchain_huggingface import HuggingFaceEndpoint
from langchain_core.output_parsers import JsonOutputParser
from dotenv import load_dotenv

from prompts.problem_generation import problem_generation_prompt, ProblemFormat
from prompts.code_evaluation import evaluation_prompt, CodeEvaluationOutput

load_dotenv()

# =============================================================================
# LLM Initialization
# We use Mistral-7B-Instruct via HuggingFace's free Serverless Inference API.
# It is highly reliable for JSON generation tasks if prompted correctly.
# =============================================================================

HF_TOKEN = os.getenv("HUGGINGFACE_API_KEY")

llm = HuggingFaceEndpoint(
    repo_id="deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
    task="conversational",
    max_new_tokens=1024,
    temperature=0.3, # Low temp for structured JSON logic
    repetition_penalty=1.1,
    huggingfacehub_api_token=HF_TOKEN,
)

# 1. Setup the Generation Pipeline
problem_parser = JsonOutputParser(pydantic_object=ProblemFormat)

generator_chain = problem_generation_prompt | llm | problem_parser

def generate_problem_with_ai(topic: str, difficulty: str, previous_topics: str = "None"):
    """Executes the specific LLM chain to generate a new competitive programming problem"""
    result = generator_chain.invoke({
        "topic": topic,
        "difficulty": difficulty,
        "previous_topics": previous_topics,
        "format_instructions": problem_parser.get_format_instructions()
    })
    return result

# 2. Setup the Evaluation Pipeline
eval_parser = JsonOutputParser(pydantic_object=CodeEvaluationOutput)

evaluator_chain = evaluation_prompt | llm | eval_parser

def evaluate_code_with_ai(title: str, description: str, source_code: str):
    """Executes the specific LLM chain to evaluate user code"""
    result = evaluator_chain.invoke({
        "title": title,
        "description": description,
        "source_code": source_code,
        "format_instructions": eval_parser.get_format_instructions()
    })
    return result
