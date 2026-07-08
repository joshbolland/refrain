import Foundation
import OSLog

enum SupabaseTimestampCodec {
    static let invalidTimestampFallback = Date(timeIntervalSince1970: 0)

    private static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "Refrain",
        category: "SupabaseTimestampCodec"
    )

    static func decode(
        _ value: String,
        fallback: Date = invalidTimestampFallback
    ) -> Date {
        if let date = decodeFractionalTimestamp(value) {
            return date
        }

        if let date = try? Date(value, strategy: .iso8601) {
            return date
        }

        let standardFormatter = ISO8601DateFormatter()
        if let date = standardFormatter.date(from: value) {
            return date
        }

        logger.error("Unable to decode Supabase timestamp: \(value, privacy: .public)")
        return fallback
    }

    static func encode(_ date: Date) -> String {
        ISO8601DateFormatter().string(from: date)
    }

    private static func decodeFractionalTimestamp(_ value: String) -> Date? {
        guard let timeSeparator = value.firstIndex(of: "T"),
              let decimalSeparator = value[timeSeparator...].firstIndex(of: ".") else {
            return nil
        }

        let fractionStart = value.index(after: decimalSeparator)
        var fractionEnd = fractionStart
        while fractionEnd < value.endIndex, value[fractionEnd].isNumber {
            fractionEnd = value.index(after: fractionEnd)
        }

        guard fractionEnd > fractionStart,
              let fraction = Double("0." + value[fractionStart..<fractionEnd]) else {
            return nil
        }

        var wholeSecondsValue = value
        wholeSecondsValue.removeSubrange(decimalSeparator..<fractionEnd)

        let formatter = ISO8601DateFormatter()
        guard let wholeSeconds = formatter.date(from: wholeSecondsValue) else {
            return nil
        }

        return wholeSeconds.addingTimeInterval(fraction)
    }
}
