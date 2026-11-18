"""Clearly marked starter cases. Dates are relative to workspace creation."""

CASES = [
    (
        "API gateway latency spike",
        "Software",
        "High",
        "API gateway",
        "P95 latency climbed from 180 ms to 2.4 s during peak traffic. Database execution time stayed flat; requests waited for sessions.",
        "In review",
        [
            (
                "gateway.log",
                "09:14:02 WARN pool acquire timeout: 5000 ms. Active database connections: 80/80. Request queue growing.",
            ),
            ("pool-metrics.csv", "time,active,capacity,wait_ms\n09:10,42,80,11\n09:14,80,80,2400"),
        ],
    ),
    (
        "Thermal throttling on edge node",
        "Hardware",
        "High",
        "Edge compute node",
        "CPU clock speed drops during sustained processing. Recorded temperature rises while the fan tachometer slows down.",
        "Resolved",
        [
            ("thermal-trace.csv", "minute,temp_c,fan_rpm,clock_mhz\n0,52,3400,2200\n8,89,720,900"),
            (
                "service-note.txt",
                "The cooling fan was sticking under load. A technician replaced it; temperatures held steady during the follow-up run.",
            ),
        ],
    ),
    (
        "Database connection exhaustion",
        "Software",
        "Critical",
        "Orders service",
        "New order requests time out while waiting for database sessions under concurrent traffic. Connection slots are fully occupied.",
        "In review",
        [
            (
                "postgres.log",
                "remaining connection slots reserved; connection pool exhausted during the checkout peak",
            )
        ],
    ),
    (
        "Intermittent sensor dropouts",
        "Hardware",
        "Medium",
        "Telemetry board",
        "The peripheral disconnects when its signal cable moves. Data returns when the enclosure is stationary.",
        "Draft",
        [
            (
                "sensor-events.log",
                "11:06 link down at connector J3\n11:07 link up after cable reposition",
            )
        ],
    ),
    (
        "Worker memory growth",
        "Software",
        "High",
        "Batch worker",
        "The container RSS increases after each import until the process exits at the memory ceiling.",
        "Resolved",
        [
            (
                "worker.log",
                "OOMKilled: memory limit exceeded after repeated batch jobs; cached objects were retained.",
            ),
            ("heap-notes.md", "Retained heap grows by 18 MB for every identical import job."),
        ],
    ),
    (
        "Controller brownout resets",
        "Hardware",
        "High",
        "Field controller",
        "The board resets when its attached load starts. The voltage monitor recorded a short drop before each reset.",
        "In review",
        [("power-trace.csv", "event,voltage\nidle,5.03\nload_start,4.21\nreset,4.19")],
    ),
    (
        "Release configuration drift",
        "Software",
        "Medium",
        "Build service",
        "A new release no longer starts in staging. The required settings differ from the previous deployment.",
        "Resolved",
        [
            (
                "release-diff.txt",
                "APP_PROFILE changed from staging to batch. Required environment variable STORE_PATH is missing.",
            )
        ],
    ),
    (
        "Queue processing delay",
        "Software",
        "Low",
        "Message consumer",
        "Jobs accumulate in the queue during the morning batch window and finish late.",
        "Draft",
        [],
    ),
]
