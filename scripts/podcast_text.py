"""Source checks for generated podcast text."""
import re


def remove_unsupported_numeric_sentences(text, article):
    """Drop an unsupported numeric claim in full, never rewrite its value."""
    source_numbers = set(re.findall(r"\b\d+(?:\.\d+)?\b", article))
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return " ".join(
        sentence for sentence in sentences
        if set(re.findall(r"\b\d+(?:\.\d+)?\b", sentence)) <= source_numbers
    )
