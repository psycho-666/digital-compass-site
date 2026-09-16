import hashlib
import json
import os
import re
from urllib.parse import urlparse

import duckdb
import requests

BRIDGE = "https://xnoalyxxrjyovivdeojo.supabase.co/functions/v1/github-core-worker-bridge"
TOKEN = os.environ["OIDC_TOKEN"]
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def bridge(action, **payload):
    response = requests.post(BRIDGE, headers=HEADERS, json={"action": action, **payload}, timeout=90)
    response.raise_for_status()
    return response.json()


def first(value):
    return value[0] if isinstance(value, list) and value else None


def social(items, domain):
    return next((url for url in (items or []) if domain in str(url).lower()), None)


def domain(url):
    if not url:
        return ""
    try:
        host = urlparse(url if "://" in url else "https://" + url).netloc.lower()
        return re.sub(r"^www\.", "", host)
    except ValueError:
        return ""


def fingerprint(name, country, website, phone):
    raw = "|".join([(name or "").strip().lower(), (country or "").strip().lower(), domain(website), re.sub(r"\D", "", phone or "")])
    return hashlib.sha256(raw.encode()).hexdigest()


def transform(row, market):
    website, phone = first(row.get("websites")), first(row.get("phones"))
    item = {
        "name": row.get("name"), "country": market["country"], "city": row.get("city"),
        "sector": row.get("category"), "website_url": website, "has_website": bool(website),
        "instagram_url": social(row.get("socials"), "instagram.com"),
        "facebook_url": social(row.get("socials"), "facebook.com"),
        "linkedin_url": social(row.get("socials"), "linkedin.com"),
        "phone": phone, "general_email": first(row.get("emails")), "source_type": "overture_places",
        "source_external_id": row.get("id"), "source_confidence": row.get("confidence"),
        "operating_status": row.get("operating_status"), "latitude": row.get("latitude"),
        "longitude": row.get("longitude"), "activity_status": "active_candidate", "status": "NEW",
    }
    item["fingerprint"] = fingerprint(item["name"], item["country"], website, phone)
    item["discovery_score"] = min(100, (20 if website else 0) + (20 if any(item.get(k) for k in ("instagram_url", "facebook_url", "linkedin_url")) else 0) + (20 if item["general_email"] else 0) + (15 if phone else 0) + round(float(item["source_confidence"] or 0) * 25))
    return item


def query(con, release, market, limit, confidence):
    xmin, ymin, xmax, ymax = market["bbox"]
    sql = f"""
      SELECT id, names.primary AS name, taxonomy.primary AS category,
        addresses[1].locality AS city, confidence, operating_status, websites, socials, emails, phones,
        bbox.xmin AS longitude, bbox.ymin AS latitude
      FROM read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*', hive_partitioning=1)
      WHERE bbox.xmin BETWEEN {float(xmin)} AND {float(xmax)}
        AND bbox.ymin BETWEEN {float(ymin)} AND {float(ymax)}
        AND addresses[1].country = '{market['country_code']}'
        AND (confidence IS NULL OR confidence >= {float(confidence)})
        AND (operating_status IS NULL OR operating_status <> 'permanently_closed')
        AND names.primary IS NOT NULL LIMIT {int(limit)}
    """
    cursor = con.execute(sql)
    columns = [d[0] for d in cursor.description]
    return [dict(zip(columns, values)) for values in cursor.fetchall()]


def main():
    claim = bridge("claim_discovery")
    task, command_id = claim.get("task"), claim.get("command_id")
    if not task:
        print("No discovery command queued.")
        return
    run_id, rows, counts = int(task["run_id"]), [], {}
    try:
        con = duckdb.connect()
        con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
        seen = set()
        for market in task["markets"]:
            raw = query(con, task["release"], market, task.get("max_per_market", 1500), task.get("min_confidence", 0.55))
            counts[market["country"]] = len(raw)
            for source in raw:
                item = transform(source, market)
                if item["fingerprint"] not in seen:
                    seen.add(item["fingerprint"])
                    rows.append(item)
        rows.sort(key=lambda x: x["discovery_score"], reverse=True)
        accepted = 0
        for offset in range(0, len(rows), 250):
            accepted += int(bridge("submit_discovery_batch", command_id=command_id, run_id=run_id, rows=rows[offset:offset + 250]).get("accepted", 0))
        bridge("finish_discovery", command_id=command_id, run_id=run_id, status="SUCCEEDED", scanned=len(rows), upserted=accepted, metadata={"release": task["release"], "market_counts": counts, "unique_rows": len(rows)})
        print(f"Discovery succeeded: scanned={len(rows)} accepted={accepted}")
    except Exception as exc:
        bridge("finish_discovery", command_id=command_id, run_id=run_id, status="FAILED", scanned=len(rows), upserted=0, metadata={"market_counts": counts}, error_message=str(exc)[:4000])
        raise


if __name__ == "__main__":
    main()
