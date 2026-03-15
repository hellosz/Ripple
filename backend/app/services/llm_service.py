import json
import logging
from typing import List, Optional
from app.config import settings

logger = logging.getLogger(__name__)

PROFILE_PROMPT = """你是一个为技术社区用户生成个性化昵称和个人描述的助手。

用户信息：
- 性别：{gender}
- 星座：{zodiac}
- 兴趣标签：{tags}

请生成 6 组昵称和描述的组合，要求：
1. 昵称 2-8 个字符，有趣且有辨识度，可以融合星座特质和技术领域
2. 描述 10-20 个字符，体现用户的技术偏好和个性
3. 风格轻松活泼，避免过于正式
4. 每组的昵称和描述需要有内在呼应

输出 JSON 格式：
[
  {{"nickname": "昵称", "description": "描述"}},
  ...
]

只输出 JSON 数组，不要其他内容。"""


async def generate_profile_candidates(
    gender: Optional[str] = None,
    zodiac: Optional[str] = None,
    tags: Optional[List[str]] = None,
) -> List[dict]:
    """Generate nickname/description candidates using LLM."""
    gender_text = gender or "保密"
    zodiac_text = zodiac or "未知"
    tags_text = ", ".join(tags) if tags else "无"

    prompt = PROFILE_PROMPT.format(
        gender=gender_text,
        zodiac=zodiac_text,
        tags=tags_text,
    )

    try:
        if settings.LLM_PROVIDER == "openai" and settings.OPENAI_API_KEY:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_BASE_URL,
            )
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.9,
            )
            content = response.choices[0].message.content.strip()
            # Clean potential markdown code blocks
            if content.startswith("```"):
                content = content.split("\n", 1)[1]
                content = content.rsplit("```", 1)[0]
            return json.loads(content)
        else:
            # Fallback: generate default profiles
            return _generate_fallback_profiles(gender_text, zodiac_text, tags)

    except Exception as e:
        logger.error(f"LLM profile generation failed: {e}")
        return _generate_fallback_profiles(gender_text, zodiac_text, tags)


def _generate_fallback_profiles(gender: str, zodiac: str, tags: Optional[List[str]]) -> List[dict]:
    """Generate fallback profiles without LLM."""
    tag = (tags[0] if tags else "Code")
    profiles = [
        {"nickname": f"{zodiac}Coder", "description": f"热爱{tag}的{zodiac}座开发者"},
        {"nickname": "ByteWalker", "description": f"在{tag}领域探索的行者"},
        {"nickname": "PixelDust", "description": "像素与代码的魔法师"},
        {"nickname": f"{tag}Master", "description": f"专注{tag}的技术达人"},
        {"nickname": "NeonDev", "description": "用代码点亮霓虹的开发者"},
        {"nickname": "CloudRunner", "description": "在云端奔跑的程序员"},
    ]
    return profiles
