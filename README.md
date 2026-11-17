# Battery page: live info and health

Extends Settings → System → Battery (`jolla-settings-system`) with:

- a level circle in the storage page's style: the left side shows the charge/discharge rate, the right side shows time until full/empty (or temperature)
- battery health: measured full-charge capacity against design capacity, condition, cycle count, chemistry, manufacturer
- live readings: current, power, voltage, temperature, charger type, charging mode, charger input and input current limit

Package: `verdanditeam-settings-battery` (noarch).

## Layout

```
rpm/verdanditeam-settings-battery.spec
qml/                           → /usr/share/jolla-settings/pages/verdanditeam-battery/
  BatteryMainPage.qml          stock battery page plus one BatteryDetails item under the header
  BatteryDetails.qml           level circle, health circle and readings; owns the BatteryInfo poller
  BatteryInfo.qml              polls sysfs every 2 s, only while the page is active and the app is in the foreground
  batteryinfo.js               all interpretation logic, pure ES5 (Qt 5.6), unit-tested with node
  BatteryLevelHeader.qml       level circle; uses DiskUsageCircle/DiskUsageLabelGroup via import "../storage"
  BatteryHealthCircle.qml      health % circle (full charge left, design right), same storage widgets
entries/verdanditeam-battery.json → /usr/share/jolla-settings/entries/: redefines the battery page entry
tests/                         node tests + real sysfs dumps (node tests/test-batteryinfo.js)
original/                      stock jolla-settings-system 1.2.95.5 files, for diffing (gitignored, not packaged)
```

Build: `sfdk build` (like sailfish-weather-backend-prometheus).

## How it hooks into Settings

This works the same way as verdandiupdater, whose `verdandiupdater-settings.json` redefines `system_settings/system/sailfishos` from the stock `sailfishos.json`. `entries/verdanditeam-battery.json` redefines `system_settings/system/battery` with our page as `source`. Settings uses the entry from the file that sorts later, and `verdanditeam-…` sorts after `battery.json`, so keep the file name starting with something later in the alphabet than "battery".

No `jolla-settings-system` files are modified. `rpm -V` stays clean, and Jolla updates and package removal need no scripts. The stock `battery_saving_switch` (top menu toggle) entry is left alone.

Verified on miami on 2026-11-17: stock page restored, entry plus page dir installed, and Settings opened our page.

Known couplings:

- `BatteryMainPage.qml` is the stock 1.2.95.5 page plus one `BatteryDetails {}` item. After a Jolla update, refresh it by copying the new stock page and re-adding those 3 lines.
- The storage widgets are imported from `../storage`, not copied. If Jolla renames them, the page fails to load.
- Licence: `BatteryMainPage.qml` is derived from Jolla's proprietary page. Check that before publishing the package outside the team.

## How the data is read and why

No C++ is needed. QML lists `/sys/class/power_supply` (FolderListModel) and reads each `uevent` with a file:// XHR, which gets all standard properties in one read per supply. Sailfish 5.2 has no statefs and `BatteryStatus` exposes neither current nor capacity.

Drivers don't follow the ABI consistently, so `batteryinfo.js` assumes nothing:

| Problem seen | Handling |
|---|---|
| `TYPE` is unreliable (Moto `bms`, `mmi_battery` claim `Mains`) | Battery-like = TYPE Battery/BMS, **or** name matches bat/bms/fg/gauge and it has capacity props. `SCOPE=Device` (BT/HID peripherals) excluded. Primary = best score (TYPE Battery, name `battery`/`BAT0`), others fill gaps. |
| Current sign differs between drivers, even on one phone (Moto `battery` +, `bms` −, both charging) | Magnitude only; direction from `STATUS` (fallback: online charger). |
| Units: µV/µA/µAh per ABI, mV/mA on some drivers; tenths °C vs m°C | Range-based detection per value (see the unit functions). mA detected via mV voltage or < 2000 raw. |
| `charge_full` copied from design (Xperia 10 IV: 4934000 = 4934000) | Treated as "not measured". Health % is shown only from a value that differs from design, and only if the ratio is between 30 and 130%. |
| Vendor health outside the ABI | Checked once, polled only if present: `<bat>/age` (Motorola, matches charge_full ratio), `<bat>/fg_asoc` (Samsung), `<bat>/soh`, `state_of_health`, `battery_soh`, `/sys/class/battchg_ext/learned_capacity` (Sony; unit guessed against design, 0 = not learned). |
| Placeholder cycle counts (Moto `battery`=1, `bms`=689) | Highest value across battery-like supplies. |
| Placeholder text values (G2: `MANUFACTURER=UNKNOWN`) | `Unknown`, `N/A`, `None`, `null` in any case count as empty for manufacturer, model, technology, condition and charge type. The first real value across battery-like supplies wins. |
| Inputs vs charger ICs (Moto: wireless input `dc` reports 0.047 V; the IC `charger` is TYPE=Unknown, ONLINE=1) | Every online non-battery supply counts. The kind comes from the best-typed one (Wireless/USB*/Mains beat Unknown). Voltage, current and limit fall back across online supplies, and voltages outside 2–25 V are dropped. |
| Laptop/PinePhone-style energy reporting | ENERGY_* / POWER_NOW supported; capacities then shown in Wh. |
| `CHARGE_COUNTER` that isn't remaining charge (G2: ~30000 at 88% of 2362 mAh, read as 30 mAh or 30,000 mAh depending on which side of the unit threshold it lands) | `CHARGE_NOW`/`CHARGE_COUNTER` are used only if they agree with `CAPACITY` within 15 points. Otherwise remaining charge is level × full capacity. |
| Time remaining | Driver's TIME_TO_FULL/EMPTY if present, else linear from smoothed current (EMA, reset when direction changes). Shown with "≈". |

Health priority: `charge_full`≠design → `energy_full`≠design → vendor file → none. With none, the page says the device doesn't report it instead of showing a fake 100%.

## Device workarounds

Fixes that are only right for one device live in `DEVICE_WORKAROUNDS` in `batteryinfo.js`, keyed by the codename from `MER_HA_DEVICE` in `/etc/hw-release`. Other devices get the generic behaviour above.

| Codename | Device | Workaround | Why |
|---|---|---|---|
| `enchilada`, `fajita` | OnePlus 6, 6T | `designFromBatteryTypeName` | `charge_full_design` is 2878000 on both phones, but the batteries are 3300 and 3700 mAh, as `bms` `BATTERY_TYPE` says (`OP_3300mah`, `OP_3700mAh`). Design comes from the mAh figure in `BATTERY_TYPE`. |
| `enchilada`, `fajita` | OnePlus 6, 6T | `chargeFullIsPlaceholder` | `charge_full` is also 2878000 on both: a kernel constant, not a measurement. Health is shown as not reported. |
| `xqcc72` | Sony Xperia 10 IV | `batteryModelNameIsPlaceholder` | `MODEL_NAME=MURRAY_BATTERY` is the Sony platform name (murray), not a battery model, and nothing else in sysfs names the cell maker (`battchg_ext/batt_id` is only a number). The model name is dropped, so the Manufacturer row is hidden. |
| `thea`, `titan` | Moto G 2014 LTE, Moto G 2014 | `chargeFullIsPlaceholder` | `charge_full` stays at 2362000 against a 2366000 design (99.8%) on old, well-used batteries, so it isn't a measurement. Health is shown as not reported. |
| `pipa` | Xiaomi Pad 6 | `powerFromVoltageTimesCurrent` | `POWER_NOW=67753699` while drawing ~2.5 W. Power is V × I instead. |
| `pipa` | Xiaomi Pad 6 | `cycleCountFromChargeBandCounters` | `CYCLE_COUNT=1` is a placeholder. The average of the Qualcomm per-charge-band `CYCLE_COUNTS` (the figure Qualcomm's driver reports) gives ~150. |

To add one: give the device's codename an entry with a descriptive flag name, then check for that flag where the value is computed.

## Status / not done

- `batteryinfo.js` is tested against the Motorola (live dump) and a reconstruction of the Xperia 10 IV readings (only the keys the user pasted).
- The page runs on miami (Edge 30 Neo, SFOS 5.2) in the packaged layout, but copied by hand. The RPM itself has not been built yet.
- New strings use `qsTr()` (no translation catalogue). `qsTrId` without a `.qm` would display raw ids.

On miami the hand-copied files are not owned by any package: `pages/verdanditeam-battery/` and `entries/verdanditeam-battery.json`. Installing the RPM over them is fine; the package simply takes ownership of the same paths.
