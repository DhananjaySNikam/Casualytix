"""Small, inspectable training corpus for the offline diagnostic classifier.

Examples are illustrative training utterances, not user incidents. The explanatory
playbooks are hypotheses to check, not observations about the user's equipment.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Mode:
    domain: str
    title: str
    category: str
    examples: tuple[str, ...]
    why: tuple[str, ...]
    contain: str
    prevent: str
    verify: str


MODES = [
    Mode(
        "Software",
        "Connection pool exhaustion",
        "Infrastructure",
        (
            "API gateway latency spikes with database pool wait timeouts",
            "all database connections busy under concurrent traffic",
            "connection slots exhausted slow queries acquire timeout",
            "requests queue waiting for a free database session",
        ),
        (
            "Requests may spend most of their time waiting for a connection.",
            "Available sessions may all be occupied during peak traffic.",
            "Long transactions or unreturned connections could hold slots.",
            "The pool budget may not match actual request concurrency.",
            "Capacity checks may not cover realistic peak workloads.",
        ),
        "Compare pool wait and query time; temporarily limit concurrency on the affected route.",
        "Set a connection budget per worker and add a load test with pool-wait alerts.",
        "At the same request rate, verify that wait time falls without exhausting database sessions.",
    ),
    Mode(
        "Software",
        "Retained memory in the worker",
        "Runtime",
        (
            "memory leak heap grows after each batch job",
            "worker killed out of memory OOM resident memory rises",
            "garbage collection cannot reclaim cached objects",
            "container crashes when RSS hits its memory limit",
        ),
        (
            "The worker may cross its memory limit over time.",
            "Live objects may accumulate between requests.",
            "A cache or listener may retain objects after use.",
            "Its lifecycle may not have an eviction or cleanup rule.",
            "Long-duration memory regression tests may be missing.",
        ),
        "Capture a heap profile before recycling one affected worker.",
        "Bound caches and test memory after repeated identical work cycles.",
        "Compare retained heap size after warmup and after a sustained workload.",
    ),
    Mode(
        "Software",
        "Release configuration mismatch",
        "Configuration",
        (
            "deployment stopped working after environment config change",
            "new release missing environment variable wrong feature flag",
            "version mismatch between staging and production",
            "service refuses to start after rollout settings update",
        ),
        (
            "The running service may be using an incompatible setting.",
            "A configuration value may differ from the tested release.",
            "The rollout may have selected an unintended environment or version.",
            "Configuration and application versions may not be validated together.",
            "The release gate may not check the active configuration contract.",
        ),
        "Diff the effective configuration against the last known-good release; revert only the confirmed change.",
        "Version configuration with the application and validate required settings before rollout.",
        "Run the failing request on a canary with the known-good settings.",
    ),
    Mode(
        "Software",
        "Upstream network instability",
        "Network",
        (
            "intermittent upstream connection reset DNS lookup failed",
            "network packet loss gateway timed out resolving hostname",
            "socket drops between service and upstream dependency",
            "DNS latency increased while local service stayed healthy",
        ),
        (
            "A request to a dependency may time out before a response arrives.",
            "Name resolution or network transit may be intermittent.",
            "The affected route may share a congested link or resolver.",
            "Failover may depend on that same route.",
            "Monitoring may not distinguish dependency latency from local processing.",
        ),
        "Compare resolver timing and dependency latency from a healthy and affected client.",
        "Add per-dependency timing, bounded retries and an independently tested fallback.",
        "Confirm recovery across both endpoints over the original failure window.",
    ),
    Mode(
        "Software",
        "Consumer throughput imbalance",
        "Process",
        (
            "message queue backlog rising consumer lag",
            "job processing lags producers enqueue faster than workers",
            "retries fill the queue and delay batch processing",
        ),
        (
            "Work may enter the queue faster than it completes.",
            "Consumer throughput may fall below the incoming rate.",
            "A slow operation or repeated retry may occupy workers.",
            "Retry and concurrency limits may be set independently of capacity.",
            "Capacity planning may not include recovery from a backlog.",
        ),
        "Measure arrivals, completions and retries; isolate the slow job class.",
        "Use bounded retries and scale consumers against age of oldest work.",
        "The backlog should drain while arrival rate remains unchanged.",
    ),
    Mode(
        "Software",
        "Storage capacity pressure",
        "Infrastructure",
        (
            "disk full no space left on device ENOSPC",
            "log volume at storage capacity writes failed",
            "inode exhaustion while rotating log files",
        ),
        (
            "A write may fail because its target volume has no available space.",
            "Logs, temporary data or inodes may have accumulated.",
            "Rotation or cleanup may not have run for this volume.",
            "Retention may exceed the allocated capacity.",
            "Capacity alerts may not cover this mount or inode count.",
        ),
        "Check free bytes and inodes; archive verified expendable logs using the retention policy.",
        "Set tested retention limits and capacity alerts for each writable volume.",
        "Verify successful writes and stable free capacity over a complete rotation cycle.",
    ),
    Mode(
        "Hardware",
        "Insufficient heat dissipation",
        "Environment",
        (
            "CPU thermal throttling temperature climbing under load",
            "fan stopped cooling heatsink airflow obstructed",
            "device overheats and shuts down after sustained use",
            "temperature sensor spike fan RPM drops",
        ),
        (
            "The component may reach its thermal protection limit.",
            "Heat removal may be slower than heat generation.",
            "Airflow, fan operation or thermal contact may be impaired.",
            "The cooling path may have degraded since commissioning.",
            "Maintenance checks may not test cooling under sustained load.",
        ),
        "Reduce load and let the unit cool. Check accessible vents and fan telemetry without opening powered equipment.",
        "Add thermal-trend alarms and schedule manufacturer-approved cooling inspections.",
        "Compare temperature and clock rate under the same safe workload before and after service.",
    ),
    Mode(
        "Hardware",
        "Unstable power delivery",
        "Machine",
        (
            "power supply voltage drops brownout device resets",
            "board reboots when motor starts transient load",
            "battery voltage sags under load random restart",
            "undervoltage fault reset power adapter current limit",
        ),
        (
            "A reset may coincide with an undervoltage event.",
            "The supply may not sustain the transient current demand.",
            "The adapter, battery or connection may have high losses.",
            "The actual load profile may exceed the rated margin.",
            "Acceptance checks may only cover steady-state current.",
        ),
        "Power down if unsafe. Check rated adapter compatibility and review recorded undervoltage events.",
        "Have a qualified technician validate supply margin across the specified load envelope.",
        "Confirm reset and undervoltage events disappear with an approved known-good supply.",
    ),
    Mode(
        "Hardware",
        "Sensor calibration drift",
        "Measurement",
        (
            "temperature sensor readings offset from calibrated reference",
            "measurement drift after replacing analog sensor",
            "probe reports increasing bias despite stable environment",
            "calibration error noisy sensor data",
        ),
        (
            "The measured value may differ from the physical condition.",
            "A persistent offset may exist in the sensing chain.",
            "Calibration values may no longer match the installed sensor.",
            "Replacement or aging may have changed the transfer response.",
            "The verification schedule may not detect this amount of drift.",
        ),
        "Compare the reading with an independent calibrated reference.",
        "Record sensor-specific calibration and schedule two-point verification.",
        "Compare readings at two known reference points within the rated range.",
    ),
    Mode(
        "Hardware",
        "Intermittent signal connection",
        "Material",
        (
            "loose cable causes intermittent disconnect link down",
            "connector contact oxidation signal drop when moved",
            "peripheral disappears then reconnects cable vibration",
        ),
        (
            "The signal path may open intermittently.",
            "A connection may lose contact as its position changes.",
            "Cable strain or connector wear could reduce continuity.",
            "The cable route may lack adequate support.",
            "Routine inspections may not include connector retention.",
        ),
        "Isolate power per the service manual and substitute an approved known-good cable.",
        "Provide strain relief and add connector checks to the maintenance schedule.",
        "Check link-error counters over the original operating cycle.",
    ),
    Mode(
        "Hardware",
        "Mechanical wear or imbalance",
        "Machine",
        (
            "fan bearing vibration high grinding motor noise",
            "rotating assembly shakes as speed rises",
            "worn bearing increases vibration and friction",
        ),
        (
            "A rotating assembly may be generating excess vibration.",
            "Rotation may be uneven or friction may be elevated.",
            "A bearing or mounting point may have worn.",
            "Operating conditions may accelerate mechanical wear.",
            "Maintenance intervals may not reflect actual running hours.",
        ),
        "Stop the equipment safely if vibration is abnormal and arrange a qualified inspection.",
        "Track vibration trends and service intervals against operating hours.",
        "Compare post-service vibration with the manufacturer’s accepted baseline.",
    ),
]


def unknown(domain: str) -> Mode:
    return Mode(
        domain,
        "Failure mechanism not yet isolated",
        "Method" if domain == "Hardware" else "Process",
        (),
        (
            "Identify the first observable deviation from normal operation.",
            "Check which component is upstream of that deviation.",
            "Compare its inputs with a known-good run.",
            "Look for the earliest configuration or operating difference.",
            "Test whether removing that difference changes the outcome.",
        ),
        "Preserve the current observations and establish a safe known-good baseline.",
        "Record a repeatable acceptance check once the mechanism is confirmed.",
        "Add a timestamped trace or measurement from both a healthy and a failing run.",
    )
