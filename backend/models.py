from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

Domain = Literal["Software", "Hardware"]
Status = Literal["Draft", "In review", "Resolved"]


class Document(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    text: str = Field(min_length=1, max_length=80000)

    @field_validator("name", "text")
    @classmethod
    def not_empty(cls, value):
        if not value.strip() or "\x00" in value:
            raise ValueError("Provide readable text.")
        return value.strip()


class IncidentInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=12000)
    domain: Domain
    severity: Literal["Low", "Medium", "High", "Critical"] = "Medium"
    system: str = Field(default="", max_length=180)
    timeline: str = Field(default="", max_length=2000)
    evidence: list[Document] = Field(default_factory=list, max_length=6)
    engine: Literal["local", "llm"] = "local"
    run: bool = True


class StatusInput(BaseModel):
    status: Literal["In review", "Resolved"]
    cause_index: int | None = Field(default=None, ge=0, le=3)
    note: str = Field(default="", max_length=2000)


class Candidate(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    category: str = Field(min_length=2, max_length=50)
    impact: float = Field(ge=0, le=1)


class Candidates(BaseModel):
    causes: list[Candidate] = Field(min_length=1, max_length=4)


class Expansion(BaseModel):
    why: list[str] = Field(min_length=5, max_length=5)
    contain: str = Field(min_length=5, max_length=1400)
    prevent: str = Field(min_length=5, max_length=1400)
    verify: str = Field(min_length=5, max_length=1400)

    @field_validator("why")
    @classmethod
    def bound_levels(cls, values):
        if any(not str(v).strip() or len(v) > 1000 for v in values):
            raise ValueError("Invalid Why depth or length")
        return values


class Expansions(BaseModel):
    findings: list[Expansion] = Field(min_length=1, max_length=4)
