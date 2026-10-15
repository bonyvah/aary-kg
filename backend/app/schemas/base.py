from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """JSON in camelCase, same as the frontend types."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)
