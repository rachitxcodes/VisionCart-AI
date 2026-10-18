"""VisionCart AI - YOLOv8 Fine-Tuning Script.

Use this script to train or fine-tune YOLOv8 on custom retail product datasets.
Trained weights can be directly referenced by setting MODEL_PATH in your .env file:
    MODEL_PATH=ml/weights/best.pt

Usage:
    python ml/train.py --data ml/data.yaml --epochs 50 --imgsz 640 --batch 16 --model yolov8n.pt
"""

import argparse
import os
import sys
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(description="Fine-tune YOLOv8 on VisionCart retail dataset")
    parser.add_argument("--data", type=str, default="ml/data.yaml", help="Path to data.yaml dataset config")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Base pretrained model (yolov8n.pt, yolov8s.pt)")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Input image dimension")
    parser.add_argument("--device", type=str, default="", help="Device: cuda, cpu, or comma-separated GPU IDs")
    parser.add_argument("--output-dir", type=str, default="ml/weights", help="Directory to save final model weights")
    return parser.parse_args()


def train():
    args = parse_args()
    print("=" * 60)
    print(" VisionCart AI - Model Fine-Tuning Pipeline")
    print("=" * 60)
    print(f"Dataset config: {args.data}")
    print(f"Base model:     {args.model}")
    print(f"Epochs:         {args.epochs}")
    print(f"Batch size:     {args.batch}")
    print(f"Image size:     {args.imgsz}")

    try:
        from ultralytics import YOLO
    except ImportError:
        print("Error: ultralytics package is not installed. Run: pip install ultralytics")
        sys.exit(1)

    # Initialize model
    model = YOLO(args.model)

    # Train model
    print("\nStarting training session...")
    results = model.train(
        data=args.data,
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        device=args.device if args.device else None,
        project="ml/runs",
        name="visioncart_retail",
        exist_ok=True,
    )

    # Save best weights to output dir
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    best_weights_src = Path("ml/runs/visioncart_retail/weights/best.pt")
    target_weights = output_dir / "custom_retail_yolov8.pt"

    if best_weights_src.exists():
        import shutil
        shutil.copy(best_weights_src, target_weights)
        print("\n" + "=" * 60)
        print(f"Training successfully completed!")
        print(f"Trained weights copied to: {target_weights}")
        print(f"To activate in VisionCart AI, update your .env file:")
        print(f"    MODEL_PATH={target_weights}")
        print("=" * 60)
    else:
        print(f"Training completed. Check results in ml/runs/visioncart_retail")


if __name__ == "__main__":
    train()

