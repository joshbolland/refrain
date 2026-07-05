import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let statusLabel = UILabel()
    private let activityIndicator = UIActivityIndicatorView(style: .large)
    private var hasStartedImport = false

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        guard !hasStartedImport else {
            return
        }

        hasStartedImport = true
        Task {
            await processSharedItems()
        }
    }

    @MainActor
    private func configureView() {
        view.backgroundColor = .systemBackground

        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        activityIndicator.startAnimating()

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0
        statusLabel.font = .preferredFont(forTextStyle: .body)
        statusLabel.text = "Importing into Refrain..."

        view.addSubview(activityIndicator)
        view.addSubview(statusLabel)

        NSLayoutConstraint.activate([
            activityIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -24),
            statusLabel.topAnchor.constraint(equalTo: activityIndicator.bottomAnchor, constant: 20),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24)
        ])
    }

    private func processSharedItems() async {
        do {
            let importedCount = try await importItems()
            guard importedCount > 0 else {
                await fail(with: "This share didn’t include supported text or audio.")
                return
            }

            await completeSuccessfully(importedCount: importedCount)
        } catch {
            await fail(with: error.localizedDescription)
        }
    }

    private func importItems() async throws -> Int {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            return 0
        }

        var importedCount = 0

        for item in extensionItems {
            let inlineText = sanitizedText(from: item.attributedContentText?.string)

            if let inlineText {
                _ = try SharedImportStore.shared.stageText(inlineText, title: nil)
                importedCount += 1
            }

            for provider in item.attachments ?? [] {
                if try await importText(from: provider, skippingDuplicateOf: inlineText) {
                    importedCount += 1
                    continue
                }

                if try await importAudio(from: provider) {
                    importedCount += 1
                }
            }
        }

        return importedCount
    }

    private func importText(
        from provider: NSItemProvider,
        skippingDuplicateOf inlineText: String?
    ) async throws -> Bool {
        guard provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) else {
            return false
        }

        let item = try await loadItem(
            from: provider,
            typeIdentifier: UTType.plainText.identifier
        )

        let text: String?
        switch item {
        case let string as String:
            text = string
        case let attributedString as NSAttributedString:
            text = attributedString.string
        case let url as URL:
            text = try String(contentsOf: url, encoding: .utf8)
        default:
            text = nil
        }

        guard let sanitizedText = sanitizedText(from: text) else {
            return false
        }

        if let inlineText, sanitizedText == inlineText {
            return false
        }

        let title = provider.suggestedName?.trimmingCharacters(in: .whitespacesAndNewlines)
        _ = try SharedImportStore.shared.stageText(sanitizedText, title: title)
        return true
    }

    private func importAudio(from provider: NSItemProvider) async throws -> Bool {
        let supportedTypes = [
            UTType.mpeg4Audio,
            .mp3,
            .wav,
            .audio
        ]

        guard let matchedType = supportedTypes.first(where: {
            provider.hasItemConformingToTypeIdentifier($0.identifier)
        }) else {
            return false
        }

        let fileURL = try await loadFileRepresentation(
            from: provider,
            typeIdentifier: matchedType.identifier
        )
        let title = provider.suggestedName?.trimmingCharacters(in: .whitespacesAndNewlines)
        _ = try SharedImportStore.shared.stageFileCopy(
            from: fileURL,
            kind: .audioRecording,
            title: title,
            typeIdentifier: matchedType.identifier
        )
        return true
    }

    private func loadItem(
        from provider: NSItemProvider,
        typeIdentifier: String
    ) async throws -> NSSecureCoding? {
        try await withCheckedThrowingContinuation { continuation in
            provider.loadItem(forTypeIdentifier: typeIdentifier, options: nil) { item, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                continuation.resume(returning: item)
            }
        }
    }

    private func sanitizedText(from text: String?) -> String? {
        guard let text else {
            return nil
        }

        let sanitized = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sanitized.isEmpty else {
            return nil
        }

        return sanitized
    }

    private func loadFileRepresentation(
        from provider: NSItemProvider,
        typeIdentifier: String
    ) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            provider.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { url, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let url else {
                    continuation.resume(throwing: ShareExtensionError.missingFileURL)
                    return
                }

                do {
                    let temporaryURL = FileManager.default.temporaryDirectory
                        .appendingPathComponent(UUID().uuidString)
                        .appendingPathExtension(url.pathExtension)

                    if FileManager.default.fileExists(atPath: temporaryURL.path) {
                        try FileManager.default.removeItem(at: temporaryURL)
                    }
                    try FileManager.default.copyItem(at: url, to: temporaryURL)
                    continuation.resume(returning: temporaryURL)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    @MainActor
    private func completeSuccessfully(importedCount: Int) async {
        statusLabel.text = importedCount == 1
            ? "Saved to Refrain. Open the app to finish importing."
            : "Saved \(importedCount) items to Refrain. Open the app to finish importing."
        activityIndicator.stopAnimating()

        try? await Task.sleep(nanoseconds: 900_000_000)
        extensionContext?.completeRequest(returningItems: nil)
    }

    @MainActor
    private func fail(with message: String) async {
        statusLabel.text = message
        activityIndicator.stopAnimating()

        try? await Task.sleep(nanoseconds: 1_200_000_000)
        extensionContext?.cancelRequest(withError: ShareExtensionError.importFailed(message))
    }
}

enum ShareExtensionError: LocalizedError {
    case missingFileURL
    case importFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingFileURL:
            return "The shared file could not be loaded."
        case .importFailed(let message):
            return message
        }
    }
}
