use std::{io::Cursor, path::Path};

use anyhow::{anyhow, Context};
use base64::{engine::general_purpose, Engine as _};
use image::ImageFormat;

pub fn decode_data_url(path: &str, data_url: &str) -> anyhow::Result<Vec<u8>> {
    let (header, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| anyhow!("invalid image data URL"))?;
    let format = match header {
        "data:image/png;base64" => ImageFormat::Png,
        "data:image/jpeg;base64" => ImageFormat::Jpeg,
        _ => return Err(anyhow!("only PNG and JPEG image exports are supported")),
    };
    let extension = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let extension_matches = match format {
        ImageFormat::Png => extension == "png",
        ImageFormat::Jpeg => extension == "jpg" || extension == "jpeg",
        _ => false,
    };
    if !extension_matches {
        return Err(anyhow!("image format does not match the file extension"));
    }
    if encoded.is_empty() {
        return Err(anyhow!("image data is empty"));
    }
    let bytes = general_purpose::STANDARD
        .decode(encoded)
        .context("invalid image Base64 data")?;
    if image::guess_format(&bytes).context("invalid image data")? != format {
        return Err(anyhow!("image data does not match the declared format"));
    }
    // Read the header without allocating another full-resolution image.
    let (width, height) = image::io::Reader::with_format(Cursor::new(&bytes), format)
        .into_dimensions()
        .context("invalid image header")?;
    if width == 0 || height == 0 {
        return Err(anyhow!("image dimensions must be greater than zero"));
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{DynamicImage, ImageOutputFormat};

    fn image_data(format: ImageOutputFormat, mime: &str) -> (String, Vec<u8>) {
        let mut bytes = Cursor::new(Vec::new());
        DynamicImage::new_rgb8(3, 2)
            .write_to(&mut bytes, format)
            .unwrap();
        let bytes = bytes.into_inner();
        let data_url = format!(
            "data:{mime};base64,{}",
            general_purpose::STANDARD.encode(&bytes)
        );
        (data_url, bytes)
    }

    #[test]
    fn preserves_png_bytes() {
        let (data_url, bytes) = image_data(ImageOutputFormat::Png, "image/png");
        assert_eq!(decode_data_url("export.png", &data_url).unwrap(), bytes);
    }

    #[test]
    fn preserves_jpeg_bytes_for_supported_extensions() {
        let (data_url, bytes) = image_data(ImageOutputFormat::Jpeg(85), "image/jpeg");
        for path in ["export.jpg", "export.jpeg", "export.JPG"] {
            assert_eq!(decode_data_url(path, &data_url).unwrap(), bytes);
        }
    }

    #[test]
    fn rejects_a_mismatched_extension_or_declared_format() {
        let (data_url, _) = image_data(ImageOutputFormat::Png, "image/png");
        assert!(decode_data_url("export.jpg", &data_url).is_err());
        assert!(decode_data_url("export", &data_url).is_err());
        assert!(
            decode_data_url("export.jpeg", &data_url.replace("image/png", "image/jpeg")).is_err()
        );
    }

    #[test]
    fn rejects_invalid_or_truncated_data() {
        for data_url in [
            "invalid",
            "data:text/plain;base64,aGVsbG8=",
            "data:image/png;base64,",
            "data:image/png;base64,%%%",
            "data:image/png;base64,aGVsbG8=",
            "data:image/png;base64,iVBORw0KGgo=",
        ] {
            assert!(
                decode_data_url("export.png", data_url).is_err(),
                "{data_url}"
            );
        }
    }
}
